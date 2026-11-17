import { ConflictException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../store/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { hashMemberPassword, verifyMemberPassword } from './member-password';

const WINDOW_MS = 15 * 60 * 1000;
const DUMMY_HASH = `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
const CREDENTIAL_STATUS = { username: true, enabled: true } as const;

@Injectable()
export class MemberPasswordService {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(username: string, password: string, clientIp: string) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    let attempt = this.attempts.get(clientIp);
    if (!attempt) {
      if (this.attempts.size >= 2000) throw new HttpException('登录繁忙，请稍后重试', 429);
      attempt = { count: 0, until: now + WINDOW_MS };
      this.attempts.set(clientIp, attempt);
    }
    if (++attempt.count > 10) throw new HttpException('尝试次数过多，请15分钟后重试', 429);
    const credential = await this.prisma.memberCredential.findUnique({ where: { username }, include: { member: true } });
    const matches = await verifyMemberPassword(password, credential?.passwordHash || DUMMY_HASH);
    const identity = credential && await this.prisma.$transaction(async tx => {
      // Share the member-binding lock so login cannot race a recovery/rotation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      const current = await tx.memberCredential.findUnique({ where: { username }, include: { member: true } });
      if (!current || !current.enabled || current.member.deletedAt || current.memberId !== credential.memberId ||
        current.sessionVersion !== credential.sessionVersion || current.passwordHash !== credential.passwordHash ||
        (current.lockedUntil && current.lockedUntil.getTime() > Date.now())) return null;
      if (!matches) {
        const failedAttempts = (current.lockedUntil ? 0 : current.failedAttempts) + 1;
        await tx.memberCredential.update({ where: { memberId: current.memberId }, data: { failedAttempts, lockedUntil: failedAttempts >= 5 ? new Date(Date.now() + WINDOW_MS) : null } });
        return null;
      }
      await tx.memberCredential.update({ where: { memberId: current.memberId }, data: { failedAttempts: 0, lockedUntil: null } });
      await tx.auditLog.create({ data: { createdAt: new Date(), id: `audit-${randomUUID()}`, actorId: current.memberId, actorRole: 'MEMBER', action: 'auth.member.password.login', targetType: 'member', targetId: current.memberId, metadata: {} } });
      return { memberId: current.memberId, authVersion: current.member.authVersion, sessionVersion: current.sessionVersion };
    });
    if (!identity) throw new UnauthorizedException('账号或密码不正确，或账号暂不可用');
    return identity;
  }

  async getStatus(memberId: string) {
    await this.assertActiveMember(this.prisma, memberId);
    const credential = await this.prisma.memberCredential.findUnique({ where: { memberId }, select: CREDENTIAL_STATUS });
    return credential ?? { username: null, enabled: false };
  }

  async setCredential(memberId: string, adminId: string, username: string, password: string) {
    const passwordHash = await hashMemberPassword(password);
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      await this.assertActiveMember(tx, memberId);
      const occupied = await tx.memberCredential.findUnique({ where: { username }, select: { memberId: true } });
      if (occupied && occupied.memberId !== memberId) throw new ConflictException('这个登录账号已被其他会员使用');
      const credential = await tx.memberCredential.upsert({
        where: { memberId },
        create: { memberId, username, passwordHash },
        update: { username, passwordHash, enabled: true, failedAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
        select: CREDENTIAL_STATUS,
      });
      await this.auditCredentialChange(tx, memberId, adminId, 'set');
      return credential;
    });
  }

  async disableCredential(memberId: string, adminId: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      await this.assertActiveMember(tx, memberId);
      const result = await tx.memberCredential.updateMany({
        where: { memberId, enabled: true }, data: { enabled: false, sessionVersion: { increment: 1 } },
      });
      if (result.count) await this.auditCredentialChange(tx, memberId, adminId, 'disable');
      return { success: true };
    });
  }

  private async assertActiveMember(db: Prisma.TransactionClient, memberId: string) {
    const member = await db.member.findUnique({ where: { id: memberId }, select: { deletedAt: true } });
    if (!member || member.deletedAt) throw new NotFoundException('会员不存在或已删除');
  }

  private async auditCredentialChange(tx: Prisma.TransactionClient, memberId: string, adminId: string, action: 'set' | 'disable') {
    await tx.auditLog.create({ data: {
      id: `audit-${randomUUID()}`, actorId: adminId, actorRole: 'ADMIN', action: `member.password.${action}`,
      targetType: 'member', targetId: memberId, metadata: {}, createdAt: new Date(),
    } });
  }
}
