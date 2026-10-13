import { NotFoundException } from '@nestjs/common';
import { DataStoreService } from '../../store/data-store.service';
import { PospalClientService } from './pospal-client.service';
import { PospalService } from './pospal.service';
import { PrismaService } from '../../store/prisma.service';

describe('PospalService member preview', () => {
  const candidate = { uid: '101', number: 'VIP1', name: 'test', balance: 12.5, giftBalance: 0, points: 15 };
  const member = { id: 'MI1', phone: '13800138000', balance: 10, points: 11 };
  const store = { getMemberById: jest.fn() };
  const client = { findMembersByPhone: jest.fn() };
  let service: PospalService;

  beforeEach(() => {
    jest.resetAllMocks();
    store.getMemberById.mockResolvedValue(member);
    client.findMembersByPhone.mockResolvedValue({ candidates: [candidate], hasMore: false, requestId: 'test-request' });
    service = new PospalService(store as unknown as DataStoreService, client as unknown as PospalClientService, {} as PrismaService);
  });

  it('returns a difference for human review without confirming binding or writing balances', async () => {
    const result = await service.previewMember('MI1');
    expect(result.state).toBe('CANDIDATE');
    expect(result.bindingConfirmed).toBe(false);
    expect(result.difference).toEqual({ balance: 2.5, points: 4 });
    expect(store.getMemberById).toHaveBeenCalledWith('MI1');
    expect(member.balance).toBe(10);
    expect(member.points).toBe(11);
  });

  it('rejects missing members and avoids platform calls for missing phones', async () => {
    store.getMemberById.mockResolvedValueOnce(undefined);
    await expect(service.previewMember('missing')).rejects.toBeInstanceOf(NotFoundException);
    store.getMemberById.mockResolvedValueOnce({ ...member, phone: undefined });
    expect((await service.previewMember('MI1')).state).toBe('NO_PHONE');
    expect(client.findMembersByPhone).not.toHaveBeenCalled();
  });

  it('does not select one of multiple records or an incomplete page', async () => {
    client.findMembersByPhone.mockResolvedValueOnce({ candidates: [candidate, { ...candidate, uid: '102' }], hasMore: false });
    expect((await service.previewMember('MI1')).state).toBe('AMBIGUOUS');
    client.findMembersByPhone.mockResolvedValueOnce({ candidates: [candidate], hasMore: true });
    const result = await service.previewMember('MI1');
    expect(result.state).toBe('AMBIGUOUS');
    expect(result.difference).toBeUndefined();
  });

  it('reports unmatched members instead of creating a new account', async () => {
    client.findMembersByPhone.mockResolvedValue({ candidates: [], hasMore: false });
    expect((await service.previewMember('MI1')).state).toBe('NOT_FOUND');
  });
});

describe('Pospal account reads and identity binding', () => {
  const member = { id: 'MI1', phone: '13800138000', balance: 10, points: 11 };
  const link = { memberId: 'MI1', customerUid: '101', customerNumber: 'VIP1', account: 'store' };
  const snapshot = { uid: '101', number: 'VIP1', name: 'test', phone: '13800138000', balance: 30, giftBalance: 10, points: 15, levelName: '银卡', discountRate: 0.9 };
  let service: PospalService;
  let store: { getMemberById: jest.Mock; listMembers: jest.Mock };
  let client: { getConfiguration: jest.Mock; getAccount: jest.Mock; getMemberByUid: jest.Mock; getRecharges: jest.Mock; getConsumptions: jest.Mock };
  let tx: { $executeRaw: jest.Mock; member: { findUnique: jest.Mock; update: jest.Mock }; pospalMemberLink: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock }; auditLog: { create: jest.Mock } };

  beforeEach(() => {
    store = { getMemberById: jest.fn().mockResolvedValue(member), listMembers: jest.fn().mockResolvedValue([member]) };
    client = {
      getConfiguration: jest.fn().mockReturnValue({ accountSource: 'pospal' }),
      getAccount: jest.fn().mockReturnValue('store'), getMemberByUid: jest.fn().mockResolvedValue(snapshot),
      getRecharges: jest.fn().mockResolvedValue([]), getConsumptions: jest.fn().mockResolvedValue([]),
    };
    tx = {
      $executeRaw: jest.fn(), member: { findUnique: jest.fn().mockResolvedValue(member), update: jest.fn() },
      pospalMemberLink: {
        findUnique: jest.fn().mockResolvedValue(link), findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
      }, auditLog: { create: jest.fn() },
    };
    Object.assign(tx, { pospalMemberSync: { findUnique: jest.fn().mockResolvedValue(null), updateMany: jest.fn() } });
    const prisma = { ...tx, $transaction: async (work: (value: typeof tx) => unknown) => work(tx) };
    service = new PospalService(store as unknown as DataStoreService, client as unknown as PospalClientService, prisma as unknown as PrismaService);
  });

  it('reads the persisted UID, caches the snapshot and does not double-count gift money', async () => {
    const profile = await service.accountProfile('MI1');
    expect(client.getMemberByUid).toHaveBeenCalledWith('101');
    expect(profile.balance).toBe(30);
    expect(profile.points).toBe(15);
    expect(profile.pospal?.customerNumber).toBe('VIP1');
    expect(tx.member.update).toHaveBeenCalledWith({ where: { id: 'MI1' }, data: { balance: 30, points: 15, levelName: '银卡', discountRate: 0.9 } });
  });

  it('does not expose the old test balance while an account is unlinked', async () => {
    tx.pospalMemberLink.findUnique.mockResolvedValue(null);
    const profile = await service.accountProfile('MI1');
    expect(profile.pospal?.state).toBe('UNLINKED');
    expect(profile.balance).toBe(0);
    expect(profile.points).toBe(0);
    expect(client.getMemberByUid).not.toHaveBeenCalled();
    expect(tx.member.update).not.toHaveBeenCalled();
  });

  it('fails on account changes or upstream failures without returning stale local money', async () => {
    client.getAccount.mockReturnValueOnce('other-store');
    await expect(service.accountProfile('MI1')).rejects.toThrow('连接账号已变更');
    client.getMemberByUid.mockRejectedValueOnce(new Error('upstream failure'));
    await expect(service.accountProfile('MI1')).rejects.toThrow('upstream failure');
    expect(tx.member.update).not.toHaveBeenCalled();
  });

  it('allows identity login to use an explicitly dated cache without depending on the upstream service', async () => {
    const syncedAt = new Date('2026-10-11T01:00:00Z');
    tx.pospalMemberLink.findUnique.mockResolvedValue({ ...link, lastSyncedAt: syncedAt });
    client.getMemberByUid.mockRejectedValue(new Error('unavailable'));
    const profile = await service.cachedAccountProfile('MI1');
    expect(profile.pospal?.syncedAt).toBe(syncedAt.toISOString());
    expect(client.getMemberByUid).not.toHaveBeenCalled();
  });

  it('scopes recharge and consumption history to the bound account instead of a caller-supplied UID', async () => {
    await service.recharges('MI1');
    await service.consumptions('MI1');
    expect(client.getRecharges).toHaveBeenCalledWith('101', 'MI1');
    expect(client.getConsumptions).toHaveBeenCalledWith('101', 'MI1');
  });

  it('requires staff identity confirmation and matching phone before recording a binding', async () => {
    await expect(service.linkMember('MI1', '101', 'admin', false)).rejects.toThrow('核实会员');
    expect(client.getMemberByUid).not.toHaveBeenCalled();
    await service.linkMember('MI1', '101', 'admin', true);
    expect(tx.pospalMemberLink.create).toHaveBeenCalledWith({ data: expect.objectContaining({ memberId: 'MI1', customerUid: '101', account: 'store' }) });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: 'admin', action: 'pospal.member.link' }) });
  });

  it('rejects mismatched phones and reusing a member belonging to another local account', async () => {
    client.getMemberByUid.mockResolvedValueOnce({ ...snapshot, phone: '13900139000' });
    await expect(service.linkMember('MI1', '101', 'admin', true)).rejects.toThrow('手机号');
    tx.pospalMemberLink.findFirst.mockResolvedValue({ ...link, memberId: 'other-member' });
    await expect(service.linkMember('MI1', '101', 'admin', true)).rejects.toThrow('已关联其他');
    expect(tx.pospalMemberLink.create).not.toHaveBeenCalled();
  });
});
