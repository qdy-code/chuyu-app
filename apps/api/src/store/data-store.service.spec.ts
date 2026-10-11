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

  it('deletes an empty member while retaining a deletion audit record', async () => {
    const member = await store.loginByWechat({ code: 'delete-empty-member' });

    const result = await store.deleteMember(member.id, 'admin-001');

    expect(result).toEqual({ success: true });
    expect(await store.getMemberById(member.id)).toBeUndefined();
    expect(
      (await store.listAuditLogs()).some(
        (log) => log.action === 'member.delete' && log.targetId === member.id,
      ),
    ).toBe(true);
  });

  it('blocks member deletion while assets or active appointments remain', async () => {
    const member = await store.loginByWechat({ code: 'delete-protected-member' });
    await store.updateMember(member.id, { balance: 10 });

    expect(await store.deleteMember(member.id, 'admin-001')).toEqual({
      success: false,
      reason: 'member has remaining assets',
    });

    await store.updateMember(member.id, { balance: 0 });
    await store.createAdminAppointment('admin-001', {
      userId: member.id,
      businessType: BUSINESS_TYPE.FLOWER,
      appointmentDate: '2099-05-10',
      startTime: '14:00',
      status: APPOINTMENT_STATUS.CONFIRMED,
    });

    expect(await store.deleteMember(member.id, 'admin-001')).toEqual({
      success: false,
      reason: 'member has active appointments',
    });
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

  it('records points-only recharges once even when identical requests race', async () => {
    const member = (await store.listMembers())[0];
    const payload = { userId: member.id, amount: 0, points: 12.5, requestId: 'points-race' };
    const results = await Promise.all([
      store.createAdminRecharge('admin-001', payload), store.createAdminRecharge('admin-001', payload),
    ]);
    expect(results[0].member?.points).toBe(member.points + 12.5);
    expect(results[1].member?.points).toBe(member.points + 12.5);
    expect(results[0].order).toBeUndefined();
    expect((await store.getMemberById(member.id))?.balance).toBe(member.balance);
    expect(await store.listPointsLedger(member.id)).toEqual([expect.objectContaining({
      changePoints: 12.5, beforePoints: member.points, afterPoints: member.points + 12.5,
    })]);
  });

  it('records opening points and negative manual adjustments independently of money', async () => {
    const { member } = await store.createMember({ nickname: 'Points member', points: 20 });
    await store.updateMember(member!.id, { points: 7.5, expectedPoints: 20, adjustmentReason: '积分更正' });
    await store.updateMember(member!.id, { nickname: 'Renamed' });
    const ledger = await store.listPointsLedger(member!.id);
    expect(ledger).toHaveLength(2);
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({ changePoints: 20, beforePoints: 0, afterPoints: 20 }),
      expect.objectContaining({ changePoints: -12.5, beforePoints: 20, afterPoints: 7.5, reason: '积分更正' }),
    ]));
  });

  it('rolls back member assets when points ledger persistence fails', async () => {
    const member = (await store.listMembers())[0];
    const failure = jest.spyOn(store as any, 'recordPointsChange').mockRejectedValueOnce(new Error('ledger failure'));
    await expect(store.createAdminRecharge('admin-001', { userId: member.id, amount: 20, points: 5 }))
      .rejects.toThrow('ledger failure');
    failure.mockRestore();
    expect(await store.getMemberById(member.id)).toEqual(member);
    expect(await store.listPointsLedger(member.id)).toEqual([]);
  });

  it('stores member messages and supports an auditable admin reply', async () => {
    const member = (await store.listMembers())[0];
    const created = await store.createMemberMessage(member.id, {
      content: '想预约下周的鲜花取花时间，请门店联系我。',
      requestId: 'message-test-request-001',
    });
    const retried = await store.createMemberMessage(member.id, {
      content: '想预约下周的鲜花取花时间，请门店联系我。',
      requestId: 'message-test-request-001',
    });
    expect(retried.id).toBe(created.id);

    expect((await store.listMemberMessages(member.id))).toEqual([
      expect.objectContaining({ id: created.id, content: '想预约下周的鲜花取花时间，请门店联系我。' }),
    ]);

    const unread = await store.listAdminMemberMessages(true);
    expect(unread).toEqual([
      expect.objectContaining({ id: created.id, memberNickname: member.nickname, memberDeleted: false }),
    ]);

    const read = await store.markMemberMessageRead(created.id, 'admin-001');
    expect(read?.readAt).toBeDefined();
    const replied = await store.replyMemberMessage(created.id, 'admin-001', '好的，门店会在营业时间联系您确认。');
    expect(replied.message?.reply).toBe('好的，门店会在营业时间联系您确认。');
    expect(await store.listAdminMemberMessages(true)).toHaveLength(0);
  });
});
