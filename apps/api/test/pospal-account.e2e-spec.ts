import { BadGatewayException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signToken } from '../src/common/token';
import { PospalClientService } from '../src/modules/pospal/pospal-client.service';
import { DataStoreService } from '../src/store/data-store.service';
import { PrismaService } from '../src/store/prisma.service';

describe('Pospal identity and account flow (isolated PostgreSQL, mocked Pospal)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let memberId: string;
  let token: string;
  const originalEnv = { ...process.env };
  const snapshot = {
    uid: '9007199254740993001', number: 'TEST-VIP1', name: 'test member', phone: '13912345678',
    balance: 30, giftBalance: 10, points: 15, levelName: '银卡', discountRate: 0.9,
  };
  const client = {
    getConfiguration: () => ({ enabled: true, configured: true, readOnly: true, missingEnv: [], accountSource: 'pospal' }),
    getAccount: () => 'test-store',
    getMemberByUid: jest.fn().mockResolvedValue(snapshot),
    findMembersByPhone: jest.fn().mockResolvedValue({ candidates: [snapshot], hasMore: false }),
    getRecharges: jest.fn().mockResolvedValue([]),
    getConsumptions: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    Object.assign(process.env, { MINIAPP_LOGIN_MODE: 'mock', MINIAPP_MOCK_OPEN_ID: '', POSPAL_ACCOUNT_SOURCE: 'pospal' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PospalClientService).useValue(client).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
    await moduleRef.get(DataStoreService).resetWithSeed();
    const login = await request(app.getHttpServer()).post('/auth/wechat/login').send({ code: 'pospal-member-one' }).expect(201);
    memberId = login.body.user.id;
    token = login.body.token;
    await request(app.getHttpServer()).patch('/members/me').set('Authorization', `Bearer ${token}`).send({ phone: snapshot.phone }).expect(200);
  });

  afterAll(async () => {
    if (app) await app.close();
    process.env = { ...originalEnv };
  });

  it('requires administrator approval, binds once and uses the remote balance including gift money', async () => {
    const body = { customerUid: snapshot.uid, identityVerified: true };
    await request(app.getHttpServer()).post(`/admin/pospal/members/${memberId}/link`).set('Authorization', `Bearer ${token}`).send(body).expect(401);
    const admin = signToken('admin-001', 'admin');
    for (let attempt = 0; attempt < 2; attempt++) {
      await request(app.getHttpServer()).post(`/admin/pospal/members/${memberId}/link`).set('Authorization', `Bearer ${admin}`).send(body).expect(201);
    }
    expect(await prisma.pospalMemberLink.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'pospal.member.link' } })).toBe(1);
    const profile = await request(app.getHttpServer()).get('/members/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(profile.body.balance).toBe(30);
    expect(profile.body.points).toBe(15);
    expect(profile.body.pospal.customerNumber).toBe('TEST-VIP1');
  });

  it('refreshes POS changes, refuses local recharge and does not give another session this balance', async () => {
    client.getMemberByUid.mockResolvedValue({ ...snapshot, balance: 55, points: 45 });
    const updated = await request(app.getHttpServer()).get('/members/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(updated.body.balance).toBe(55);
    expect(updated.body.points).toBe(45);
    await request(app.getHttpServer()).post('/admin/recharges').set('Authorization', `Bearer ${signToken('admin-001', 'admin')}`)
      .send({ userId: memberId, amount: 5 }).expect(503);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).balance).toBe(55);
    const other = await request(app.getHttpServer()).post('/auth/wechat/login').send({ code: 'pospal-member-two' }).expect(201);
    const calls = client.getMemberByUid.mock.calls.length;
    const privateProfile = await request(app.getHttpServer()).get('/members/me').set('Authorization', `Bearer ${other.body.token}`)
      .set('x-user-id', memberId).expect(200);
    expect(privateProfile.body.id).toBe(other.body.user.id);
    expect(privateProfile.body.pospal.state).toBe('UNLINKED');
    expect(privateProfile.body.balance).toBe(0);
    expect(client.getMemberByUid.mock.calls.length).toBe(calls);
  });

  it('fails a fresh balance read without overwriting the last successful snapshot', async () => {
    client.getMemberByUid.mockRejectedValueOnce(new BadGatewayException('test upstream unavailable'));
    const response = await request(app.getHttpServer()).get('/members/me').set('Authorization', `Bearer ${token}`).expect(502);
    expect(response.body.balance).toBeUndefined();
    expect((await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).balance).toBe(55);
  });
});
