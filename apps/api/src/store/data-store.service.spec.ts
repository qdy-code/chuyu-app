import { Test, TestingModule } from '@nestjs/testing';
import '../config/load-env';
import { DataStoreService } from './data-store.service';
import { PrismaService } from './prisma.service';
import { APPOINTMENT_STATUS, BUSINESS_TYPE } from '@member-platform/shared';

const describeWithTestDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithTestDatabase('DataStoreService', () => {
  let moduleRef: TestingModule;
  let store: DataStoreService;

  beforeEach(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
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
    expect(user.id).toMatch(/^MI\d{12}$/);
    expect(user.openId).toBe('wx-new-user-001');
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

  it('deletes a consumption order and restores the member balance', async () => {
    const member = (await store.listMembers())[0];
    const previousBalance = member.balance;
    const created = await store.createConsumptionOrder('admin-001', {
      userId: member.id,
      title: '待冲销订单',
      originalPrice: 38,
      orderDate: '2026-04-10',
    });

    const result = await store.deleteConsumptionOrder(created.order!.id, 'admin-001');

    expect(result).toEqual({ success: true });
    expect((await store.getMemberById(member.id))?.balance).toBe(previousBalance);
    expect(await store.listConsumptionOrders(member.id)).toHaveLength(0);
  });

  it('groups consumption revenue by day and month', async () => {
    const member = (await store.listMembers())[0];
    await store.createConsumptionOrder('admin-001', {
      userId: member.id,
      title: '四月订单一',
      originalPrice: 20,
      orderDate: '2026-04-09',
    });
    await store.createConsumptionOrder('admin-001', {
      userId: member.id,
      title: '四月订单二',
      originalPrice: 30,
      orderDate: '2026-04-10',
    });

    const overview = await store.getRevenueOverview('2026-04');

    expect(overview.monthSummary.consumptionAmount).toBe(50);
    expect(overview.monthSummary.orderCount).toBe(2);
    expect(overview.daily.find((item) => item.period === '2026-04-09')?.consumptionAmount).toBe(20);
    expect(overview.monthly.find((item) => item.period === '2026-04')?.orderCount).toBe(2);
  });

  it('rejects overlapping confirmed appointment ranges', async () => {
    const member = (await store.listMembers())[0];
    const first = await store.createAdminAppointment('admin-001', {
      userId: member.id,
      businessType: BUSINESS_TYPE.NAIL,
      appointmentDate: '2099-01-10',
      startTime: '10:00',
      endTime: '11:00',
      status: APPOINTMENT_STATUS.CONFIRMED,
    });
    expect(first.appointment?.status).toBe(APPOINTMENT_STATUS.CONFIRMED);

    const overlapping = await store.createAdminAppointment('admin-001', {
      userId: member.id,
      businessType: BUSINESS_TYPE.NAIL,
      appointmentDate: '2099-01-10',
      startTime: '10:30',
      endTime: '11:30',
      status: APPOINTMENT_STATUS.CONFIRMED,
    });
    expect(overlapping.appointment).toBeUndefined();
    expect(overlapping.reason).toBe('appointment time slot already booked');
  });

  it('blocks member bookings for an unavailable business date and restores it', async () => {
    const member = (await store.listMembers())[0];
    const blocked = await store.createAppointmentUnavailableDate('admin-001', {
      appointmentDate: '2099-04-10',
      businessType: BUSINESS_TYPE.NAIL,
      reason: '当日预约已满',
    });

    expect(blocked.unavailableDate?.businessType).toBe(BUSINESS_TYPE.NAIL);
    expect(await store.listAppointmentUnavailableDates({ businessType: BUSINESS_TYPE.NAIL, fromDate: '2099-01-01' }))
      .toHaveLength(1);

    const overlappingRule = await store.createAppointmentUnavailableDate('admin-001', {
      appointmentDate: '2099-04-10',
      businessType: 'ALL',
    });
    expect(overlappingRule.unavailableDate).toBeUndefined();
    expect(overlappingRule.reason).toBe('appointment date has unavailable settings');

    const nailBooking = await store.createAppointment(member.id, {
      businessType: BUSINESS_TYPE.NAIL,
      appointmentDate: '2099-04-10',
      startTime: '10:00',
    });
    expect(nailBooking.appointment).toBeUndefined();
    expect(nailBooking.reason).toBe('appointment date unavailable');

    const flowerBooking = await store.createAppointment(member.id, {
      businessType: BUSINESS_TYPE.FLOWER,
      appointmentDate: '2099-04-10',
      startTime: '10:00',
    });
    expect(flowerBooking.appointment).toBeDefined();

    await store.deleteAppointmentUnavailableDate(blocked.unavailableDate!.id, 'admin-001');
    const reopened = await store.createAppointment(member.id, {
      businessType: BUSINESS_TYPE.NAIL,
      appointmentDate: '2099-04-10',
      startTime: '10:00',
    });
    expect(reopened.appointment).toBeDefined();
  });

  it('takes an accessory offline after acceptance and blocks a second acceptance', async () => {
    const firstMember = (await store.listMembers())[0];
    const secondMember = await store.loginByWechat({ code: 'second-accessory-member' });
    const product = (await store.listCatalogProducts(BUSINESS_TYPE.ACCESSORY, { includeInactive: true }))[0];

    const first = await store.createAppointment(firstMember.id, {
      businessType: BUSINESS_TYPE.ACCESSORY,
      productId: product.id,
      appointmentDate: '2099-02-10',
      startTime: '10:00',
    });
    const second = await store.createAppointment(secondMember.id, {
      businessType: BUSINESS_TYPE.ACCESSORY,
      productId: product.id,
      appointmentDate: '2099-02-10',
      startTime: '11:00',
    });

    const accepted = await store.updateAppointment(first.appointment!.id, {
      status: APPOINTMENT_STATUS.CONFIRMED,
    });
    expect(accepted.appointment?.status).toBe(APPOINTMENT_STATUS.CONFIRMED);
    expect((await store.listCatalogProducts(BUSINESS_TYPE.ACCESSORY)).some((item) => item.id === product.id)).toBe(false);

    const duplicateAcceptance = await store.updateAppointment(second.appointment!.id, {
      status: APPOINTMENT_STATUS.CONFIRMED,
    });
    expect(duplicateAcceptance.appointment).toBeUndefined();
    expect(duplicateAcceptance.reason).toBe('product is not available');
  });

  it('deletes an existing appointment', async () => {
    const member = (await store.listMembers())[0];
    const created = await store.createAdminAppointment('admin-001', {
      userId: member.id,
      businessType: BUSINESS_TYPE.FLOWER,
      appointmentDate: '2099-03-10',
      startTime: '14:00',
      status: APPOINTMENT_STATUS.CONFIRMED,
    });

    const result = await store.deleteAppointment(created.appointment!.id, 'admin-001');

    expect(result).toEqual({ success: true });
    expect((await store.listAppointments()).some((item) => item.id === created.appointment!.id)).toBe(false);
  });
});
