import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/store/prisma.service';
import { DataStoreService } from '../src/store/data-store.service';
import { PospalClientService } from '../src/modules/pospal/pospal-client.service';
import { WechatMiniappService } from '../src/modules/wechat/wechat-miniapp.service';
import { hashMemberPassword } from '../src/modules/auth/member-password';
import { MemberPasswordService } from '../src/modules/auth/member-password.service';
import { verifyToken, signToken } from '../src/common/token';

describe('production member password login (isolated database)', () => {
  let app: INestApplication, db: PrismaService, store: DataStoreService, memberId: string;
  let service: MemberPasswordService;
  const password = 'TestOnlyPassword!2026';
  const username = 'issued_member';
  const previousEnv = { ...process.env };
  beforeAll(async () => {
    process.env.MINIAPP_LOGIN_MODE = 'real'; process.env.POSPAL_ACCOUNT_SOURCE = 'local'; process.env.POSPAL_MEMBER_SYNC_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WechatMiniappService).useValue({ resolveOpenId: async (code: string) => code, resolvePhoneNumber: jest.fn() })
      .overrideProvider(PospalClientService).useValue({ getConfiguration: () => ({ enabled: false, accountSource: 'local', memberSyncEnabled: false }) }).compile();
    app = moduleRef.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = moduleRef.get(PrismaService); store = moduleRef.get(DataStoreService); service = moduleRef.get(MemberPasswordService);
  });
  beforeEach(async () => {
    await store.resetWithSeed();
    (service as any).attempts.clear();
    const member = await store.loginByWechat({ code: 'password-account-isolated' }); memberId = member.id;
    await db.memberCredential.create({ data: { memberId, username, passwordHash: await hashMemberPassword(password) } });
  });
  afterAll(async () => { if (app) await app.close(); process.env = previousEnv; });
  const login = (pass = password, account = username) => request(app.getHttpServer()).post('/auth/member/password-login').send({ username: account, password: pass });
  async function token() { return (await login().expect(201)).body.token; }
  it('uses a salted hash and a normal member token; reads only this member and cannot administer', async () => {
    const other = await store.loginByWechat({ code: 'other-real-member' });
    await db.memberMessage.create({ data: { id: 'other-secret-message', userId: other.id, content: 'PRIVATE_CUSTOMER_DATA' } });
    const response = await login(password, username.toUpperCase()).expect(201);
    expect(response.body.user.id).toBe(memberId); expect(response.body.loginMethod).toBe('password');
    expect(response.body.user.phone).toBeUndefined(); expect(response.body.user.balance).toBe(0);
    expect(verifyToken(response.body.token)).toMatchObject({ sub: memberId, role: 'member', method: 'password', version: 0 });
    const credential = await db.memberCredential.findUniqueOrThrow({ where: { username } });
    expect(credential.passwordHash).not.toContain(password); expect(credential.passwordHash).toMatch(/^scrypt-v1\$/);
    const auth = { Authorization: `Bearer ${response.body.token}`, 'x-user-id': other.id };
    const me = await request(app.getHttpServer()).get('/members/me/cached-profile').set(auth).expect(200); expect(me.body.id).toBe(memberId);
    for (const path of ['/members/me/messages', '/members/me/appointments', '/members/me/points-ledger', '/recharges/my', '/consumptions/my']) {
      const r = await request(app.getHttpServer()).get(path).set(auth).expect(200); expect(r.body).toEqual([]);
    }
    await request(app.getHttpServer()).get('/admin/members').set(auth).expect(401);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|PRIVATE_CUSTOMER_DATA/);
  });
  it('rejects missing, invalid, unknown and incorrect credentials without creating members', async () => {
    const count = await db.member.count();
    await request(app.getHttpServer()).post('/auth/member/password-login').send({ username, password, role: 'admin' }).expect(400);
    await login('x'.repeat(129)).expect(400); await login(password, 'bad@account').expect(400);
    const a = await login('wrong').expect(401), b = await login(password, 'does_not_exist').expect(401);
    expect(a.body.message).toBe(b.body.message); expect(await db.member.count()).toBe(count);
  });
  it('locks repeated failures in the database and expires the lock; IP throttles unknown accounts too', async () => {
    for (let i = 0; i < 5; i++) await login('wrong').expect(401);
    await login().expect(401);
    const locked = await db.memberCredential.findUniqueOrThrow({ where: { username } }); expect(locked.failedAttempts).toBe(5); expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    await db.memberCredential.update({ where: { username }, data: { lockedUntil: new Date(0) } });
    await login().expect(201);
    expect((await db.memberCredential.findUniqueOrThrow({ where: { username } })).failedAttempts).toBe(0);
    (service as any).attempts.clear();
    for (let i = 0; i < 10; i++) await login('wrong', 'unknown_member').expect(401);
    await login('wrong', 'unknown_member').expect(429);
  });
  it('does not allow a password session to bind phones, recover or link another identity, including forged methods', async () => {
    const auth = { Authorization: `Bearer ${await token()}` };
    for (const method of ['put', 'patch'] as const) {
      await request(app.getHttpServer())[method]('/members/me/phone').set(auth).send({ code: 'someone-elses-wechat-phone' }).expect(403);
      await request(app.getHttpServer())[method]('/members/me').set(auth).send({ phone: '13988889999' }).expect(403);
    }
    await request(app.getHttpServer()).put('/MEMBERS/ME/PHONE/').set(auth).send({ code: 'mixed-case-wechat-phone' }).expect(403);
    await request(app.getHttpServer()).put('/MEMBERS/ME/').set(auth).send({ phone: '13988889999' }).expect(403);
    await request(app.getHttpServer()).post('/members/me/link-code').set(auth).send({ phone: '13988889999' }).expect(403);
    await request(app.getHttpServer()).post('/members/me/phone-recovery/confirm').set(auth).send({ code: '12345678', confirmed: true }).expect(403);
    await request(app.getHttpServer()).put('/members/me').set(auth).send({ nickname: '正常会员' }).expect(200);
    expect((await db.member.findUniqueOrThrow({ where: { id: memberId } })).phone).toBeNull();
  });
  it('uses real member writes for messages and bookings, with no dummy datasets or automatic submissions', async () => {
    const auth = { Authorization: `Bearer ${await token()}` };
    const r = await request(app.getHttpServer()).post('/members/me/messages').set(auth).send({ content: 'isolated test message', requestId: 'password-message-test' }).expect(201);
    expect(r.body.userId).toBe(memberId); expect(await db.memberMessage.count({ where: { userId: memberId } })).toBe(1);
    expect(await db.appointment.count({ where: { userId: memberId } })).toBe(0);
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const booking = await request(app.getHttpServer()).post('/members/me/appointments').set(auth).send({ businessType: 'NAIL', appointmentDate: date, startTime: '10:00', endTime: '11:00' }).expect(201);
    expect(booking.body.userId).toBe(memberId); expect(booking.body.status).toBe('PENDING');
    expect(await db.appointment.count({ where: { userId: memberId } })).toBe(1);
  });
  it('revokes tokens and rejects disabled/deleted accounts or changed auth versions', async () => {
    const bearer = await token();
    await db.memberCredential.update({ where: { username }, data: { enabled: false } }); await login().expect(401);
    await request(app.getHttpServer()).get('/members/me/cached-profile').auth(bearer, { type: 'bearer' }).expect(401);
    await db.memberCredential.update({ where: { username }, data: { enabled: true } });
    await db.member.update({ where: { id: memberId }, data: { authVersion: { increment: 1 } } });
    await request(app.getHttpServer()).get('/members/me/cached-profile').auth(bearer, { type: 'bearer' }).expect(401);
    expect(verifyToken(await token())?.version).toBe(1);
    await db.member.update({ where: { id: memberId }, data: { deletedAt: new Date() } }); await login().expect(401);
  });
  it('keeps WeChat login separate and refuses to retire a credential-bearing source account during recovery', async () => {
    const wx = await request(app.getHttpServer()).post('/auth/wechat/login').send({ code: 'ordinary-wechat-member' }).expect(201);
    expect(verifyToken(wx.body.token)?.method).toBeUndefined(); expect(wx.body.user.id).not.toBe(memberId);
    const target = await store.loginByWechat({ code: 'other-phone-member' });
    await db.member.update({ where: { id: target.id }, data: { phone: '13988889999' } });
    await expect(store.preparePhoneRecovery(memberId, '13988889999')).rejects.toThrow();
    await request(app.getHttpServer()).get('/members/me/cached-profile').auth(signToken(memberId, 'admin'), { type: 'bearer' }).expect(401);
  });
});
