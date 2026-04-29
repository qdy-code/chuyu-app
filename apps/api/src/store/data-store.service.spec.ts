import { Test, TestingModule } from '@nestjs/testing';
import '../config/load-env';
import { DataStoreService } from './data-store.service';
import { PrismaService } from './prisma.service';

describe('DataStoreService', () => {
  let moduleRef: TestingModule;
  let store: DataStoreService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PrismaService, DataStoreService],
    }).compile();
    store = moduleRef.get(DataStoreService);
    await store.resetWithSeed();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates a new member when login with a new code', async () => {
    const user = await store.loginByWechat({ code: 'new-user-001' });
    expect(user.id).toBe('wx-new-user-001');
    expect(await store.getMemberById(user.id)).toBeDefined();
  });

  it('keeps balance ledger consistency during approve flow', async () => {
    const member = (await store.listMembers())[0];
    const previousBalance = member.balance;
    const order = await store.applyRecharge(member.id, { amount: 50 });

    const approved = await store.approveRecharge(order.id, 'admin-001');
    expect(approved?.status).toBe('APPROVED');

    const updated = await store.getMemberById(member.id);
    expect(updated?.balance).toBe(previousBalance + 50);
  });

  it('creates a consumption order and deducts member balance', async () => {
    const member = (await store.listMembers())[0];
    const previousBalance = member.balance;

    const result = await store.createConsumptionOrder('admin-001', {
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
    expect((await store.getMemberById(member.id))?.balance).toBe(previousBalance - 20);
    expect((await store.listConsumptionOrders(member.id)).length).toBeGreaterThan(0);
  });
});
