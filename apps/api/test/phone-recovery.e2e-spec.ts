import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/store/prisma.service';
import { DataStoreService } from '../src/store/data-store.service';
import { WechatMiniappService } from '../src/modules/wechat/wechat-miniapp.service';
import { PospalClientService } from '../src/modules/pospal/pospal-client.service';
import { signToken, verifyToken } from '../src/common/token';

describe('phone conflict recovery (isolated PostgreSQL, simulated WeChat, no POS writes)', () => {
  let app: INestApplication, db: PrismaService, store: DataStoreService;
  let sequence = 0;
  const phone = '13988889999';
  const previousEnv = { ...process.env };
  const resolvePhoneNumber = jest.fn(async () => phone);
  beforeAll(async () => {
    process.env.MINIAPP_LOGIN_MODE = 'real'; process.env.POSPAL_ACCOUNT_SOURCE = 'local'; process.env.POSPAL_MEMBER_SYNC_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WechatMiniappService).useValue({ resolvePhoneNumber, resolveOpenId: async (code: string) => code })
      .overrideProvider(PospalClientService).useValue({ getConfiguration: () => ({ enabled: false, configured: false, accountSource: 'local', memberSyncEnabled: false }) })
      .compile();
    app = moduleRef.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = moduleRef.get(PrismaService); store = moduleRef.get(DataStoreService);
  });
  beforeEach(async () => { jest.clearAllMocks(); await store.resetWithSeed(); });
  afterAll(async () => { if (app) await app.close(); process.env = previousEnv; });
  const auth = (id: string, version = 0) => ({ Authorization: `Bearer ${signToken(id, 'member', undefined, version)}`, 'x-user-id': 'forged-other-member' });
  async function pair() {
    sequence++;
    const source = await store.loginByWechat({ code: 'new-wx-' + sequence, openIdHint: 'new-wx-' + sequence });
    const target = await store.loginByWechat({ code: 'old-wx-' + sequence, openIdHint: 'old-wx-' + sequence });
    await db.member.update({ where: { id: target.id }, data: { phone, phoneVerifiedAt: new Date() } });
    return { source, target };
  }
  async function begin(id: string) {
    const r = await request(app.getHttpServer()).put('/members/me/phone').set(auth(id)).send({ code: 'fresh-wechat-phone-code' }).expect(409);
    expect(resolvePhoneNumber).toHaveBeenCalledWith('fresh-wechat-phone-code', undefined);
    expect(JSON.stringify(r.body)).not.toContain('balance'); expect(JSON.stringify(r.body)).not.toContain('old-wx');
    return r.body.phoneRecovery as { code: string; mode: string; expiresAt: string };
  }
  async function confirm(id: string, code: string, status = 201) { return request(app.getHttpServer()).post('/members/me/phone-recovery/confirm').set(auth(id)).send({ code, confirmed: true }).expect(status); }
  async function allAssets(id: string) {
    const member = await db.member.findUniqueOrThrow({ where: { id } });
    const { openId, authVersion, ...unchanged } = member;
    return { member: unchanged, recharges: await db.rechargeOrder.findMany({ where: { userId: id } }), consumptions: await db.consumptionOrder.findMany({ where: { userId: id } }), appointments: await db.appointment.findMany({ where: { userId: id } }), balances: await db.balanceLedger.findMany({ where: { userId: id } }), points: await db.pointsLedger.findMany({ where: { userId: id } }), messages: await db.memberMessage.findMany({ where: { userId: id } }), link: await db.pospalMemberLink.findUnique({ where: { memberId: id } }), sync: await db.pospalMemberSync.findUnique({ where: { memberId: id } }) };
  }
  it('generates a stable default nickname on creation and preserves existing or chosen member data on later login', async () => {
    const openId = 'new-default-name-openid';
    const first = await store.loginByWechat({ code: openId, openIdHint: openId });
    expect(first.nickname).toMatch(/^月光会员[0-9A-F]{6}$/);
    expect(first.phone).toBeUndefined(); expect(first.balance).toBe(0); expect(first.points).toBe(0);
    const again = await store.loginByWechat({ code: openId, openIdHint: openId });
    expect(again.id).toBe(first.id); expect(again.nickname).toBe(first.nickname);
    expect(await db.member.count({ where: { openId } })).toBe(1);
    await db.member.update({ where: { id: first.id }, data: { nickname: '我的自定义昵称', avatarUrl: '/existing-avatar.jpg', balance: 123, points: 45 } });
    const customized = await store.loginByWechat({ code: openId, openIdHint: openId });
    expect(customized).toMatchObject({ nickname: '我的自定义昵称', avatarUrl: '/existing-avatar.jpg', balance: 123, points: 45 });
    await db.member.update({ where: { id: first.id }, data: { nickname: '微信用户' } });
    expect((await store.loginByWechat({ code: openId, openIdHint: openId })).nickname).toBe('微信用户');
  });
  it('does not treat a custom name resembling the generated format as a recoverable system default', async () => {
    const { source, target } = await pair();
    expect(target.nickname).toMatch(/^月光会员[0-9A-F]{6}$/);
    const chosen = target.nickname.slice(0, -1) + (target.nickname.endsWith('F') ? '0' : 'F');
    await db.member.update({ where: { id: target.id }, data: { nickname: chosen } });
    const proof = await begin(source.id); expect(proof.mode).toBe('STORE_REVIEW');
    await confirm(source.id, proof.code, 400);
    expect((await db.member.findUniqueOrThrow({ where: { id: target.id } })).nickname).toBe(chosen);
  });
  it('binds new phones normally and repeated authorization keeps the same member', async () => {
    const source = await store.loginByWechat({ code: 'fresh-member' });
    for (let i = 0; i < 2; i++) {
      const r = await request(app.getHttpServer()).put('/members/me/phone').set(auth(source.id)).send({ code: 'fresh-code-' + i }).expect(200);
      expect(r.body.id).toBe(source.id); expect(r.body.phone).toBe(phone);
    }
    expect((await db.member.findUniqueOrThrow({ where: { id: source.id } })).authVersion).toBe(0);
  });
  it('requires fresh verified phone and explicit confirmation before recovering an unused account', async () => {
    const { source, target } = await pair();
    await request(app.getHttpServer()).put('/members/me').set(auth(source.id)).send({ phone }).expect(400);
    expect(await db.memberLinkRequest.findUnique({ where: { userId: source.id } })).toBeNull();
    const proof = await begin(source.id); expect(proof.mode).toBe('SELF_SERVICE');
    expect((await db.member.findUniqueOrThrow({ where: { id: target.id } })).openId).toBe(target.openId);
    await request(app.getHttpServer()).post('/members/me/phone-recovery/confirm').set(auth(source.id)).send({ code: proof.code, confirmed: false }).expect(400);
    const r = await confirm(source.id, proof.code);
    expect(r.body.user.id).toBe(target.id); expect(verifyToken(r.body.token)).toMatchObject({ sub: target.id, role: 'member', version: 1 });
    expect((await db.member.findUniqueOrThrow({ where: { id: target.id } })).openId).toBe(source.openId);
    expect((await db.member.findUniqueOrThrow({ where: { id: source.id } })).deletedAt).not.toBeNull();
    await request(app.getHttpServer()).get('/members/me/cached-profile').set(auth(target.id)).expect(401);
    await request(app.getHttpServer()).get('/members/me/cached-profile').set(auth(source.id)).expect(401);
    await request(app.getHttpServer()).get('/members/me/cached-profile').set('Authorization', `Bearer ${r.body.token}`).expect(200);
    const again = await request(app.getHttpServer()).post('/auth/wechat/login').send({ code: source.openId }).expect(201);
    expect(again.body.user.id).toBe(target.id);
    expect(verifyToken(again.body.token)?.version).toBe(1);
    await expect(store.confirmPhoneRecovery(source.id, proof.code)).rejects.toThrow();
  });
  it('keeps all original assets and records, requiring an administrator to confirm a protected account', async () => {
    const { source, target } = await pair(); const now = new Date();
    await db.member.update({ where: { id: target.id }, data: { balance: 952.5, points: 317, nickname: '原会员', avatarUrl: '/original.jpg', birthday: '03-15' } });
    await db.rechargeOrder.create({ data: { id: 'protected-recharge', userId: target.id, amount: 1000, status: 'APPROVED', createdAt: now, updatedAt: now } });
    await db.consumptionOrder.create({ data: { id: 'protected-consumption', orderNo: 'protected-order', userId: target.id, title: '原消费记录', originalPrice: 47.5, finalPrice: 47.5, discountRate: 1, orderDate: '2026-10-01', createdBy: 'test-admin', createdAt: now } });
    await db.appointment.create({ data: { id: 'protected-appointment', userId: target.id, memberNickname: '原会员', businessType: 'NAIL', appointmentDate: '2027-01-01', startTime: '13:00', endTime: '14:00', status: 'PENDING', createdAt: now, updatedAt: now } });
    await db.balanceLedger.create({ data: { id: 'protected-balance', userId: target.id, changeAmount: -47.5, type: 'CONSUME_ORDER_CREATED', relatedOrderId: 'protected-consumption', createdAt: now } });
    await db.pointsLedger.create({ data: { id: 'protected-points', userId: target.id, changePoints: 317, beforePoints: 0, afterPoints: 317, reason: '原积分记录' } });
    await db.memberMessage.create({ data: { id: 'protected-message', userId: target.id, content: '原会员留言' } });
    await db.pospalMemberLink.create({ data: { memberId: target.id, account: 'isolated-test', customerUid: 'original-pos', customerNumber: 'ORIGINAL-VIP', lastSyncedAt: now } });
    await db.pospalMemberSync.create({ data: { memberId: target.id, account: 'isolated-test', customerNumber: 'ORIGINAL-VIP', state: 'DONE' } });
    const before = await allAssets(target.id); const proof = await begin(source.id); expect(proof.mode).toBe('STORE_REVIEW');
    await confirm(source.id, proof.code, 400);
    expect(await allAssets(target.id)).toEqual(before);
    await request(app.getHttpServer()).post(`/admin/members/${target.id}/wechat-link`).set(auth(source.id)).send({ code: proof.code, verifiedPhone: phone, identityVerified: true }).expect(401);
    const admin = (await store.getAdmins())[0];
    await expect(store.confirmMemberLink(target.id, admin.id, { code: proof.code, verifiedPhone: '13900000000', identityVerified: true })).rejects.toThrow();
    await request(app.getHttpServer()).post(`/admin/members/${target.id}/wechat-link`).set('Authorization', `Bearer ${signToken(admin.id, 'admin')}`).send({ code: proof.code, verifiedPhone: phone, identityVerified: false }).expect(400);
    await request(app.getHttpServer()).post(`/admin/members/${target.id}/wechat-link`).set('Authorization', `Bearer ${signToken(admin.id, 'admin')}`).send({ code: proof.code, verifiedPhone: phone, identityVerified: true }).expect(201);
    expect(await allAssets(target.id)).toEqual(before);
    await request(app.getHttpServer()).get('/members/me/cached-profile').set(auth(target.id)).expect(401);
    expect((await db.member.findUniqueOrThrow({ where: { id: target.id } })).authVersion).toBe(1);
  });
  it.each(['balance', 'history', 'pospal'] as const)('rechecks %s changes after a challenge before any transfer', async kind => {
    const { source, target } = await pair(); const proof = await begin(source.id);
    if (kind === 'balance') await db.member.update({ where: { id: target.id }, data: { balance: 1 } });
    if (kind === 'history') await db.memberMessage.create({ data: { id: 'new-history', userId: target.id, content: '新增记录' } });
    if (kind === 'pospal') await db.pospalMemberSync.create({ data: { memberId: target.id, customerNumber: 'pending-sync', account: 'isolated-test' } });
    await confirm(source.id, proof.code, 400);
    expect((await db.member.findUniqueOrThrow({ where: { id: target.id } })).openId).toBe(target.openId);
    expect((await db.member.findUniqueOrThrow({ where: { id: source.id } })).deletedAt).toBeNull();
  });
  it('rejects expired, guessed, other-session and changed-binding challenges', async () => {
    const { source, target } = await pair(); const proof = await begin(source.id);
    await confirm(source.id, '00000000', 400);
    const other = await store.loginByWechat({ code: 'other-session' }); await confirm(other.id, proof.code, 400);
    await db.memberLinkRequest.update({ where: { userId: source.id }, data: { expiresAt: new Date(0) } }); await confirm(source.id, proof.code, 400);
    const newer = await begin(source.id);
    await db.member.update({ where: { id: target.id }, data: { authVersion: { increment: 1 } } }); await confirm(source.id, newer.code, 400);
    await request(app.getHttpServer()).put('/members/me/phone').send({ code: 'fresh-code' }).expect(401);
  });
  it.each(['points', 'pospal'] as const)('refuses to retire a source account with its own %s data', async kind => {
    const { source, target } = await pair();
    if (kind === 'points') await db.pointsLedger.create({ data: { id: 'source-history', userId: source.id, changePoints: 1, beforePoints: 0, afterPoints: 1, reason: '历史积分，即使当前为零也不能丢弃' } });
    else await db.pospalMemberSync.create({ data: { memberId: source.id, account: 'isolated-test', customerNumber: 'source-pending-sync' } });
    await request(app.getHttpServer()).put('/members/me/phone').set(auth(source.id)).send({ code: 'fresh-code' }).expect(400);
    expect(await db.memberLinkRequest.findUnique({ where: { userId: source.id } })).toBeNull();
    expect((await db.member.findUniqueOrThrow({ where: { id: target.id } })).openId).toBe(target.openId);
  });
  it('permits only one of two concurrent recovery confirmations', async () => {
    const { source, target } = await pair(); const proof = await begin(source.id);
    const results = await Promise.allSettled([store.confirmPhoneRecovery(source.id, proof.code), store.confirmPhoneRecovery(source.id, proof.code)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await db.member.findUniqueOrThrow({ where: { id: target.id } })).authVersion).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'member.wechat.recover', targetId: target.id } })).toBe(1);
  });
});
