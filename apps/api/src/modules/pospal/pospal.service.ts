import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { MemberProfile, PospalMemberPreview } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { PrismaService } from '../../store/prisma.service';
import { PospalClientService } from './pospal-client.service';

@Injectable()
export class PospalService {
  constructor(private readonly store: DataStoreService, private readonly client: PospalClientService, private readonly prisma: PrismaService) {}

  async listAccountMembers(): Promise<MemberProfile[]> {
    const members = await this.store.listMembers();
    if (this.client.getConfiguration().accountSource !== 'pospal') return members;
    const links = await this.prisma.pospalMemberLink.findMany();
    const byMember = new Map(links.map((link) => [link.memberId, link]));
    return members.map((member) => {
      const link = byMember.get(member.id);
      if (!link) return { ...member, balance: 0, points: 0, levelName: '会员', discountRate: 1, pospal: { state: 'UNLINKED' as const } };
      return { ...member,
        balance: link.lastSyncedAt ? member.balance : 0,
        points: link.lastSyncedAt ? member.points : 0,
        pospal: { state: 'LINKED' as const, customerNumber: link.customerNumber, syncedAt: link.lastSyncedAt?.toISOString() },
      };
    });
  }

  async cachedAccountProfile(memberId: string): Promise<MemberProfile> {
    const member = await this.store.getMemberById(memberId);
    if (!member) throw new NotFoundException('member not found');
    if (this.client.getConfiguration().accountSource !== 'pospal') return member;
    const link = await this.prisma.pospalMemberLink.findUnique({ where: { memberId } });
    const job = await this.prisma.pospalMemberSync.findUnique({ where: { memberId } });
    const memberSync = job ? { state: job.state, message: job.lastError || undefined } : undefined;
    if (!link || link.account !== this.client.getAccount()) {
      return { ...member, balance: 0, points: 0, levelName: '会员', discountRate: 1, pospal: { state: 'UNLINKED', memberSync } };
    }
    if (!link.lastSyncedAt) return { ...member, balance: 0, points: 0, levelName: '会员', discountRate: 1, pospal: { state: 'UNLINKED', customerNumber: link.customerNumber, memberSync } };
    return { ...member, pospal: { state: 'LINKED', customerNumber: link.customerNumber, syncedAt: link.lastSyncedAt.toISOString(), memberSync } };
  }

  async recharges(memberId: string) {
    if (this.client.getConfiguration().accountSource !== 'pospal') return this.store.listRechargeOrders(memberId);
    const link = await this.memberLink(memberId);
    return link ? this.client.getRecharges(link.customerUid, memberId) : [];
  }

  async consumptions(memberId: string) {
    if (this.client.getConfiguration().accountSource !== 'pospal') return this.store.listConsumptionOrders(memberId);
    const link = await this.memberLink(memberId);
    return link ? this.client.getConsumptions(link.customerUid, memberId) : [];
  }

  private async memberLink(memberId: string) {
    const member = await this.store.getMemberById(memberId);
    if (!member) throw new NotFoundException('member not found');
    const link = await this.prisma.pospalMemberLink.findUnique({ where: { memberId } });
    if (link && link.account !== this.client.getAccount()) throw new ServiceUnavailableException('银豹连接账号已变更，请由门店重新核对会员绑定');
    return link;
  }

  async accountProfile(memberId: string): Promise<MemberProfile> {
    const member = await this.store.getMemberById(memberId);
    if (!member) throw new NotFoundException('member not found');
    if (this.client.getConfiguration().accountSource !== 'pospal') return member;
    const link = await this.prisma.pospalMemberLink.findUnique({ where: { memberId } });
    if (!link) return { ...member, balance: 0, points: 0, levelName: '会员', discountRate: 1, pospal: { state: 'UNLINKED' } };
    if (link.account !== this.client.getAccount()) throw new ServiceUnavailableException('银豹连接账号已变更，请由门店重新核对会员绑定');
    const snapshot = await this.client.getMemberByUid(link.customerUid);
    const syncedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      const current = await tx.pospalMemberLink.findUnique({ where: { memberId } });
      if (!current || current.customerUid !== link.customerUid || current.account !== link.account) throw new ServiceUnavailableException('会员关联已变更，请重新加载');
      await tx.member.update({ where: { id: memberId }, data: { balance: snapshot.balance, points: snapshot.points, levelName: snapshot.levelName, discountRate: snapshot.discountRate } });
      await tx.pospalMemberLink.update({ where: { memberId }, data: { customerNumber: snapshot.number, lastSyncedAt: syncedAt } });
    });
    return { ...member, balance: snapshot.balance, points: snapshot.points, levelName: snapshot.levelName, discountRate: snapshot.discountRate,
      pospal: { state: 'LINKED', customerNumber: snapshot.number, syncedAt: syncedAt.toISOString() } };
  }

  async linkMember(memberId: string, customerUid: string, adminId: string, identityVerified: boolean) {
    if (!identityVerified) throw new BadRequestException('请先核实会员本人身份');
    const snapshot = await this.client.getMemberByUid(customerUid);
    const account = this.client.getAccount();
    return this.prisma.$transaction(async (tx) => {
      // 与现有会员关联操作使用同一把事务锁，避免确认期间手机号或身份被替换。
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member || member.deletedAt) throw new NotFoundException('member not found');
      if (!member.phone || !snapshot.phone || member.phone.trim() !== snapshot.phone) throw new BadRequestException('会员预留手机号与银豹资料不一致');
      const existing = await tx.pospalMemberLink.findFirst({ where: { OR: [{ memberId }, { customerUid }] } });
      if (existing) {
        if (existing.memberId === memberId && existing.customerUid === customerUid && existing.account === account) return { customerNumber: existing.customerNumber };
        throw new BadRequestException('小程序会员或银豹会员已关联其他账户，请先人工核对');
      }
      await tx.pospalMemberSync.updateMany({ where: { memberId, state: { in: ['REVIEW', 'FAILED', 'PENDING'] } }, data: { state: 'DONE', lastError: null } });
      const syncedAt = this.client.getConfiguration().accountSource === 'pospal' ? new Date() : null;
      await tx.pospalMemberLink.create({ data: { memberId, customerUid, customerNumber: snapshot.number, account, lastSyncedAt: syncedAt } });
      if (syncedAt) await tx.member.update({ where: { id: memberId }, data: { balance: snapshot.balance, points: snapshot.points, levelName: snapshot.levelName, discountRate: snapshot.discountRate } });
      await tx.auditLog.create({ data: {
        id: `a-${randomUUID()}`, actorId: adminId, actorRole: 'ADMIN', action: 'pospal.member.link',
        targetType: 'member', targetId: memberId, metadata: { customerUid, customerNumber: snapshot.number, account, identityVerified: true }, createdAt: new Date(),
      } });
      return { customerNumber: snapshot.number };
    });
  }

  async previewMember(memberId: string): Promise<PospalMemberPreview> {
    const member = await this.store.getMemberById(memberId);
    if (!member) throw new NotFoundException('member not found');
    const base = {
      memberId,
      local: { balance: member.balance, points: member.points },
      bindingConfirmed: false as const,
    };
    if (!member.phone?.trim()) {
      return { ...base, state: 'NO_PHONE', candidates: [], hasMore: false };
    }
    const response = await this.client.findMembersByPhone(member.phone.trim());
    if (response.hasMore || response.candidates.length > 1) {
      return { ...base, ...response, state: 'AMBIGUOUS' };
    }
    const candidate = response.candidates[0];
    if (!candidate) return { ...base, ...response, state: 'NOT_FOUND' };
    return {
      ...base,
      ...response,
      state: 'CANDIDATE',
      difference: {
        balance: Number((candidate.balance - member.balance).toFixed(2)),
        points: Number((candidate.points - member.points).toFixed(2)),
      },
    };
  }
}
