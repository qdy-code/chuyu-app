import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../store/prisma.service';
import { verifyMemberPassword } from './member-password';

const WINDOW_MS = 15 * 60 * 1000;
const DUMMY_HASH = `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

@Injectable()
export class MemberPasswordService {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(username: string, password: string, clientIp: string): Promise<{ memberId: string; authVersion: number }> {
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
      if (!current || !current.enabled || current.member.deletedAt || current.passwordHash !== credential.passwordHash || (current.lockedUntil && current.lockedUntil.getTime() > Date.now())) return null;
      if (!matches) {
        const failedAttempts = (current.lockedUntil ? 0 : current.failedAttempts) + 1;
        await tx.memberCredential.update({ where: { memberId: current.memberId }, data: { failedAttempts, lockedUntil: failedAttempts >= 5 ? new Date(Date.now() + WINDOW_MS) : null } });
        return null;
      }
      await tx.memberCredential.update({ where: { memberId: current.memberId }, data: { failedAttempts: 0, lockedUntil: null } });
      await tx.auditLog.create({ data: { createdAt: new Date(), id: `audit-${randomUUID()}`, actorId: current.memberId, actorRole: 'MEMBER', action: 'auth.member.password.login', targetType: 'member', targetId: current.memberId, metadata: {} } });
      return { memberId: current.memberId, authVersion: current.member.authVersion };
    });
    if (!identity) throw new UnauthorizedException('账号或密码不正确，或账号暂不可用');
    return identity;
  }
}
