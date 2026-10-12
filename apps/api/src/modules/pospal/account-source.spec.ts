import { DataStoreService } from '../../store/data-store.service';
import { PrismaService } from '../../store/prisma.service';

describe('Pospal account source prevents local accounting', () => {
  const previousSource = process.env.POSPAL_ACCOUNT_SOURCE;
  afterEach(() => {
    if (previousSource === undefined) delete process.env.POSPAL_ACCOUNT_SOURCE;
    else process.env.POSPAL_ACCOUNT_SOURCE = previousSource;
  });

  it('rejects every legacy money mutation before touching the database', async () => {
    process.env.POSPAL_ACCOUNT_SOURCE = 'pospal';
    const store = new DataStoreService({} as PrismaService);
    const attempts = [
      () => store.createMember({ nickname: 'test', balance: 1 }),
      () => store.applyRecharge('member', { amount: 1 }),
      () => store.createAdminRecharge('admin', { userId: 'member', amount: 1 }),
      () => store.approveRecharge('recharge', 'admin'),
      () => store.createConsumptionOrder('admin', { userId: 'member', title: 'test', originalPrice: 1 }),
      () => store.deleteConsumptionOrder('order', 'admin'),
      () => store.updateMember('member', { points: 1 }),
      () => store.updateMember('member', { balance: 1 }),
    ];
    for (const attempt of attempts) await expect(attempt()).rejects.toThrow('银豹收银系统管理');
  });
});
