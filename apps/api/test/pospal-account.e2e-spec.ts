import { BadGatewayException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { signToken } from '../src/common/token';
import { PospalClientService } from '../src/modules/pospal/pospal-client.service';
import { DataStoreService } from '../src/store/data-store.service';
import { PrismaService } from '../src/store/prisma.service';

describe('Pospal identity and account flow (isolated PostgreSQL, mocked Pospal)', () => {
  let app: NestExpressApplication;
  let uploadDir: string;
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
    uploadDir = await mkdtemp(join(tmpdir(), 'chuyu-profile-e2e-'));
    process.env.UPLOAD_DIR = uploadDir;
    Object.assign(process.env, { MINIAPP_LOGIN_MODE: 'mock', MINIAPP_MOCK_OPEN_ID: '', POSPAL_ACCOUNT_SOURCE: 'pospal' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PospalClientService).useValue(client).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
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
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
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

  it('persists nickname and avatar for the authenticated member and serves the saved image', async () => {
    const nickname = '测试微信昵称';
    await request(app.getHttpServer()).put('/members/me').set('Authorization', `Bearer ${token}`)
      .send({ nickname }).expect(200);
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#345678' } }).png().toBuffer();
    const avatar = await request(app.getHttpServer()).post('/members/me/avatar').set('Authorization', `Bearer ${token}`)
      .attach('file', image, { filename: 'test-avatar.png', contentType: 'image/png' }).expect(201);
    expect(avatar.body.nickname).toBe(nickname);
    expect(avatar.body.avatarUrl).toMatch(/^\/uploads\/avatar-.+\.jpg$/);
    expect(avatar.body.balance).toBe(55);
    const saved = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    expect(saved.nickname).toBe(nickname);
    expect(saved.avatarUrl).toBe(avatar.body.avatarUrl);
    const download = await request(app.getHttpServer()).get(saved.avatarUrl).expect(200).expect('Content-Type', /image\/jpeg/);
    expect(await sharp(download.body).metadata()).toMatchObject({ width: 512, height: 512, format: 'jpeg' });
    const members = await request(app.getHttpServer()).get('/admin/members')
      .set('Authorization', `Bearer ${signToken('admin-001', 'admin')}`).expect(200);
    expect(members.body.find((member: { id: string }) => member.id === memberId))
      .toMatchObject({ nickname, avatarUrl: saved.avatarUrl });
    await request(app.getHttpServer()).post('/members/me/avatar')
      .attach('file', image, { filename: 'test.png', contentType: 'image/png' }).expect(401);
    await request(app.getHttpServer()).put('/members/me').set('Authorization', `Bearer ${token}`)
      .send({ nickname: '改名', userId: 'other-member' }).expect(400);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).nickname).toBe(nickname);
  });
});
