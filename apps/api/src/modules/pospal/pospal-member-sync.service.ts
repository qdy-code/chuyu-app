import { BadGatewayException, BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../store/prisma.service';
import type { PospalMemberSync } from '../../generated/prisma/client';
import { PospalClientService, PospalMemberUnavailableException } from './pospal-client.service';

@Injectable()
export class PospalMemberSyncService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private blockedUntil = 0;
  constructor(private readonly prisma: PrismaService, private readonly client: PospalClientService) {}

  onModuleInit() {
    if (!this.client.getConfiguration().memberSyncEnabled) return;
    this.timer = setInterval(() => { void this.processNext().catch(() => undefined); }, 30_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async list() {
    const jobs = await this.prisma.pospalMemberSync.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
    return jobs.map(({ memberId, customerNumber, state, attempts, lastError, updatedAt }) => ({ memberId, customerNumber, state, attempts, lastError, updatedAt }));
  }

  async retry(memberId: string, adminId: string) {
    return this.prisma.$transaction(async tx => {
      const job = await tx.pospalMemberSync.findUnique({ where: { memberId } });
      if (!job || job.state === 'RUNNING' || job.state === 'DONE') throw new BadRequestException('没有可重试的同步任务');
      const changed = await tx.pospalMemberSync.updateMany({ where: { memberId, state: job.state }, data: { state: 'PENDING', attempts: 0, lastError: null, nextAttemptAt: new Date() } });
      if (!changed.count) throw new BadRequestException('同步任务已变更，请刷新');
      await tx.auditLog.create({ data: { id: `a-${randomUUID()}`, actorId: adminId, actorRole: 'ADMIN', action: 'pospal.member.sync.retry', targetType: 'member', targetId: memberId, metadata: {}, createdAt: new Date() } });
      return { queued: true };
    });
  }

  async confirmAndQueue(memberId: string, adminId: string, identityVerified: boolean) {
    if (!identityVerified) throw new BadRequestException('请先核实顾客本人身份及预留手机号');
    if (this.client.getConfiguration().accountSource !== 'pospal' || !this.client.getAccount()) throw new BadRequestException('尚未配置银豹账务来源');
    const account = this.client.getAccount();
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member || member.deletedAt || !member.phone || !/^1[3-9]\d{9}$/.test(member.phone)) throw new BadRequestException('会员不存在或未填写有效手机号');
      const link = await tx.pospalMemberLink.findUnique({ where: { memberId } });
      if (link) throw new BadRequestException('该会员已关联银豹，请刷新资料');
      // The worker claims jobs with a row lock, independently of the member lock.
      // Lock before reading state so a concurrent claim cannot be overwritten.
      await tx.$queryRaw`SELECT "memberId" FROM "PospalMemberSync" WHERE "memberId" = ${memberId} FOR UPDATE`;
      const job = await tx.pospalMemberSync.findUnique({ where: { memberId } });
      if (job && (job.account !== account || job.state === 'RUNNING' || job.state === 'DONE')) throw new BadRequestException('同步任务正在处理或状态已变更，请刷新后核对');
      await tx.member.update({ where: { id: memberId }, data: { phoneStoreVerifiedAt: new Date() } });
      await tx.pospalMemberSync.upsert({
        where: { memberId },
        create: { memberId, account, customerNumber: `MP${memberId}` },
        update: { state: 'PENDING', attempts: 0, lastError: null, nextAttemptAt: new Date(), revision: { increment: 1 } },
      });
      await tx.auditLog.create({ data: { id: `a-${randomUUID()}`, actorId: adminId, actorRole: 'ADMIN', action: 'pospal.member.sync.store-confirm', targetType: 'member', targetId: memberId, metadata: { identityVerified: true, verification: 'STORE' }, createdAt: new Date() } });
      return { queued: true };
    });
  }

  async processNext() {
    const config = this.client.getConfiguration();
    if (this.running || Date.now() < this.blockedUntil || !config.memberSyncEnabled || !config.enabled || !config.configured || config.accountSource !== 'pospal') return;
    this.running = true;
    try {
      // 数据库租约允许多个 API 实例安全领取；进程退出后可恢复任务。
      const job = await this.prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw<{ memberId: string }[]>`
          SELECT "memberId" FROM "PospalMemberSync"
          WHERE ("state" = 'PENDING' AND "nextAttemptAt" <= NOW())
             OR ("state" = 'RUNNING' AND "leaseUntil" < NOW())
          ORDER BY "nextAttemptAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
        if (!rows[0]) return null;
        return tx.pospalMemberSync.update({ where: rows[0], data: { state: 'RUNNING', attempts: { increment: 1 }, leaseUntil: new Date(Date.now() + 120_000) } });
      });
      if (!job) return;
      let finalState = 'DONE';
      let message: string | null = null;
      try {
        if (job.attempts > 3) throw new BadGatewayException('自动尝试次数已达上限');
        const member = await this.prisma.member.findUnique({ where: { id: job.memberId } });
        if (!member || member.deletedAt || !member.phone || (!member.phoneVerifiedAt && !member.phoneStoreVerifiedAt) || job.account !== this.client.getAccount()) {
          finalState = 'REVIEW'; message = '手机号验证或连接账号已变更，请门店核对';
        } else {
          const link = await this.prisma.pospalMemberLink.findUnique({ where: { memberId: job.memberId } });
          if (link) {
            if (link.account !== job.account) throw new BadGatewayException('连接账号不一致');
            await this.client.updateMemberNickname(link.customerUid, member.nickname);
          } else {
            const existing = await this.client.findMemberByNumber(job.customerNumber);
            let uid = job.customerUid;
            if (existing && (job.createAttemptedAt || uid)) {
              // 恢复本任务已发起的开户，校验原编号、手机号及已记录的 UID。
              if (existing.phone !== member.phone || (uid && uid !== existing.uid)) {
                finalState = 'REVIEW'; message = '银豹已有该编号或手机号不符，请门店核对';
              } else uid = existing.uid;
            } else if (uid) {
              finalState = 'REVIEW'; message = '已创建的银豹会员无法查到，请门店核对';
            } else {
              const matches = await this.client.findMembersByPhone(member.phone);
              const candidate = matches.candidates[0];
              if (existing && (existing.phone !== member.phone || existing.uid !== candidate?.uid)) {
                finalState = 'REVIEW'; message = '银豹已有该编号或手机号不符，请门店核对';
              } else if (matches.hasMore || matches.candidates.length > 1) {
                finalState = 'REVIEW'; message = '银豹有多条同手机号会员，请核对后关联';
              } else if (candidate) {
                if (member.phoneVerifiedAt) {
                  message = await this.linkExistingMember(job, member.phone, candidate);
                  if (!message) return;
                } else {
                  message = '银豹已有同手机号会员，请核实身份并关联原会员';
                }
                finalState = 'REVIEW';
              } else {
                // 在外部写入前保存意图。下次重试先查询编号，不能盲目重复开户。
                await this.prisma.$transaction(async tx => {
                  await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
                  const current = await tx.member.findUnique({ where: { id: member.id } });
                  if (!current || current.deletedAt || current.phone !== member.phone || (!current.phoneVerifiedAt && !current.phoneStoreVerifiedAt)) throw new BadGatewayException('会员资料已变更');
                  await tx.pospalMemberSync.update({ where: { memberId: job.memberId }, data: { createAttemptedAt: new Date() } });
                });
                uid = await this.client.createMember(job.customerNumber, member.phone, member.nickname);
                await this.prisma.pospalMemberSync.update({ where: { memberId: job.memberId }, data: { customerUid: uid } });
              }
            }
            if (uid && finalState === 'DONE') {
              const snapshot = await this.client.getMemberByUid(uid);
              if (snapshot.phone !== member.phone || snapshot.number !== job.customerNumber) throw new BadGatewayException('银豹开户资料不符');
              await this.prisma.$transaction(async tx => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
                const current = await tx.member.findUnique({ where: { id: member.id } });
                if (!current || current.deletedAt || current.phone !== member.phone || (!current.phoneVerifiedAt && !current.phoneStoreVerifiedAt)) throw new BadGatewayException('会员资料已变更');
                const occupied = await tx.pospalMemberLink.findFirst({ where: { OR: [{ memberId: member.id }, { customerUid: uid! }] } });
                if (occupied && (occupied.memberId !== member.id || occupied.customerUid !== uid || occupied.account !== job.account)) throw new BadGatewayException('会员关联已变更');
                if (!occupied) {
                  await tx.pospalMemberLink.create({ data: { memberId: member.id, customerUid: uid!, customerNumber: job.customerNumber, account: job.account, lastSyncedAt: new Date() } });
                  await tx.member.update({ where: { id: member.id }, data: { balance: snapshot.balance, points: snapshot.points, levelName: snapshot.levelName, discountRate: snapshot.discountRate } });
                  await tx.auditLog.create({ data: { id: `a-${randomUUID()}`, actorId: member.id, actorRole: 'MEMBER', action: 'pospal.member.create.link', targetType: 'member', targetId: member.id, metadata: { customerUid: uid!, customerNumber: job.customerNumber }, createdAt: new Date() } });
                }
              });
              // 初次关联读取真实账务；此后由会员主动刷新。
            }
          }
        }
      } catch (error) {
        const serviceBlocked = error instanceof BadGatewayException && error.message.includes('Token 余额不足');
        if (serviceBlocked) this.blockedUntil = Date.now() + 15 * 60_000;
        const unsupportedCharacters = error instanceof BadGatewayException && error.message.startsWith('银豹不支持会员资料中的部分特殊字符');
        finalState = serviceBlocked || unsupportedCharacters || job.attempts >= 3 ? 'FAILED' : 'PENDING';
        message = serviceBlocked ? '银豹 Token 余额不足或服务暂停；恢复后请重试'
          : unsupportedCharacters ? '银豹不支持会员资料中的部分特殊字符，请联系门店处理后重试'
          : '银豹同步未完成，请稍后重试或联系门店核对';
      }
      await this.prisma.$transaction(async tx => {
        const current = await tx.pospalMemberSync.findUnique({ where: { memberId: job.memberId } });
        if (!current || current.leaseUntil?.getTime() !== job.leaseUntil?.getTime()) return;
        // A fresh phone verification can make a previously ambiguous job eligible.
        const dirty = current.revision !== job.revision && (finalState === 'DONE' || finalState === 'REVIEW');
        await tx.pospalMemberSync.update({ where: { memberId: job.memberId }, data: {
          state: dirty ? 'PENDING' : finalState, lastError: dirty ? null : message, leaseUntil: null,
          ...(dirty ? { attempts: 0 } : {}),
          nextAttemptAt: new Date(Date.now() + (dirty ? 0 : Math.min(job.attempts, 3) * 300_000)),
        } });
      });
    } finally { this.running = false; }
  }

  private async linkExistingMember(job: PospalMemberSync, phone: string, candidate: { uid: string; number: string }) {
    let snapshot: Awaited<ReturnType<PospalClientService['getMemberByUid']>>;
    try {
      snapshot = await this.client.getMemberByUid(candidate.uid);
    } catch (error) {
      if (error instanceof PospalMemberUnavailableException) return error.message;
      throw error;
    }
    if (snapshot.uid !== candidate.uid || snapshot.phone !== phone || snapshot.number !== candidate.number) {
      return '银豹会员资料已变更，请门店核对';
    }

    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      await tx.$queryRaw`SELECT "memberId" FROM "PospalMemberSync" WHERE "memberId" = ${job.memberId} FOR UPDATE`;
      const currentJob = await tx.pospalMemberSync.findUnique({ where: { memberId: job.memberId } });
      if (currentJob?.state !== 'RUNNING' || currentJob.leaseUntil?.getTime() !== job.leaseUntil?.getTime()) {
        return '同步任务已变更，请刷新';
      }
      const member = await tx.member.findUnique({ where: { id: job.memberId } });
      if (!member || member.deletedAt || member.phone !== phone || !member.phoneVerifiedAt || job.account !== this.client.getAccount()) {
        return '手机号验证或连接账号已变更，请门店核对';
      }
      const occupied = await tx.pospalMemberLink.findFirst({
        where: { OR: [{ memberId: member.id }, { customerUid: snapshot.uid }] },
      });
      if (occupied && (occupied.memberId !== member.id || occupied.customerUid !== snapshot.uid || occupied.account !== job.account)) {
        return '小程序会员或银豹会员已关联，请门店核对';
      }

      const syncedAt = new Date();
      if (!occupied) {
        await tx.pospalMemberLink.create({
          data: { memberId: member.id, customerUid: snapshot.uid, customerNumber: snapshot.number, account: job.account, lastSyncedAt: syncedAt },
        });
        await tx.member.update({
          where: { id: member.id },
          data: { balance: snapshot.balance, points: snapshot.points, levelName: snapshot.levelName, discountRate: snapshot.discountRate },
        });
        await tx.auditLog.create({
          data: {
            id: `a-${randomUUID()}`, actorId: member.id, actorRole: 'MEMBER', action: 'pospal.member.link.auto',
            targetType: 'member', targetId: member.id,
            metadata: { customerUid: snapshot.uid, customerNumber: snapshot.number, verification: 'WECHAT_PHONE' }, createdAt: syncedAt,
          },
        });
      }
      const profileChanged = currentJob.revision !== job.revision;
      await tx.pospalMemberSync.update({
        where: { memberId: member.id },
        data: {
          state: profileChanged ? 'PENDING' : 'DONE', leaseUntil: null, lastError: null,
          nextAttemptAt: syncedAt, customerUid: snapshot.uid, ...(profileChanged ? { attempts: 0 } : {}),
        },
      });
      return null;
    });
  }
}
