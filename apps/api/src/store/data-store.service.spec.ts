import { Test } from '@nestjs/testing';
import { DataStoreService } from './data-store.service';

describe('DataStoreService', () => {
  let store: DataStoreService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DataStoreService],
    }).compile();
    store = moduleRef.get(DataStoreService);
    store.resetWithSeed();
  });

  it('creates a new member when login with a new code', () => {
    const user = store.loginByWechat({ code: 'new-user-001' });
    expect(user.id).toContain('u-');
    expect(store.getMemberById(user.id)).toBeDefined();
  });

  it('keeps balance ledger consistency during approve flow', () => {
    const member = store.listMembers()[0];
    const previousBalance = member.balance;
    const order = store.applyRecharge(member.id, { amount: 50 });

    const approved = store.approveRecharge(order.id, 'admin-001');
    expect(approved?.status).toBe('APPROVED');

    const updated = store.getMemberById(member.id)!;
    expect(updated.balance).toBe(previousBalance + 50);
  });

  it('creates a consumption order and deducts member balance', () => {
    const member = store.listMembers()[0];
    const previousBalance = member.balance;

    const result = store.createConsumptionOrder('admin-001', {
      userId: member.id,
      title: '门店消费',
      originalPrice: 20,
      productType: '护理',
      effectImages: ['/uploads/test-a.jpg'],
      orderDate: '2026-04-09',
      remark: '测试订单',
    });

    expect(result.order).toBeDefined();
    expect(result.reason).toBeUndefined();
    expect(result.order?.finalPrice).toBe(20);
    expect(store.getMemberById(member.id)?.balance).toBe(previousBalance - 20);
    expect(store.listConsumptionOrders(member.id).length).toBeGreaterThan(0);
  });
});
