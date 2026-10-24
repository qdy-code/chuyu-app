// Operations-only command. Credentials arrive via stdin, never argv or source.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './store/prisma.service';
import { hashMemberPassword } from './modules/auth/member-password';

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const username = String(input.username || '').toLowerCase();
  const password = String(input.password || '');
  const nickname = String(input.nickname || '会员');
  if (!/^[a-z0-9_]{4,32}$/.test(username) || password.length < 12 || password.length > 128 || !nickname || nickname.length > 30) throw Error('Invalid account fields');
  const passwordHash = await hashMemberPassword(password);
  const db = new PrismaService();
  try {
    const result = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      const existing = await tx.memberCredential.findUnique({ where: { username }, include: { member: true } });
      if (input.rotate === true) {
        if (!existing || existing.member.deletedAt) throw Error('Account not available for rotation');
        await tx.memberCredential.update({ where: { username }, data: { passwordHash, failedAttempts: 0, lockedUntil: null, enabled: true } });
        await tx.member.update({ where: { id: existing.memberId }, data: { authVersion: { increment: 1 } } });
      } else {
        if (existing) throw Error('Account exists; refusing to overwrite');
        const level = await tx.memberLevel.findFirst({ orderBy: { minPoints: 'asc' } });
        if (!level) throw Error('No member level configured');
        const id = `m-${randomUUID()}`;
        await tx.member.create({ data: { id, openId: `password-account-${randomUUID()}`, nickname, avatarUrl: '', levelId: level.id, levelName: level.name, discountRate: level.discountRate, balance: 0, points: 0, credential: { create: { username, passwordHash } } } });
      }
      const account = await tx.memberCredential.findUniqueOrThrow({ where: { username } });
      await tx.auditLog.create({ data: { createdAt: new Date(), id: `audit-${randomUUID()}`, actorId: 'ops-member-credentials', actorRole: 'ADMIN', action: input.rotate === true ? 'member.password.rotate' : 'member.password.provision', targetType: 'member', targetId: account.memberId, metadata: { username } } });
      return { username, memberId: account.memberId };
    });
    console.log(JSON.stringify(result));
  } finally { await db.$disconnect(); }
}

void main().catch(() => { console.error('Member account provisioning failed; no credential was printed'); process.exitCode = 1; });
