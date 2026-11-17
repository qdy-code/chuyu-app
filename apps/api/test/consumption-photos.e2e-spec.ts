import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/store/prisma.service';
import { DataStoreService } from '../src/store/data-store.service';
import { PospalClientService } from '../src/modules/pospal/pospal-client.service';
import { signToken } from '../src/common/token';
import { getUploadDir } from '../src/config/upload-path';

// Only an isolated database and simulated POS reads. Never create a real sale/member.
describe('Private consumption photos (isolated PostgreSQL, simulated POS)', () => {
  let app: NestExpressApplication, db: PrismaService, store: DataStoreService;
  let owner: string, other: string, source = 'pospal', image: Buffer;
  const previousEnv = { ...process.env };
  const order = (uid: string, memberId: string) => ({ id: `pospal-${uid}`, orderNo: `SALE-${uid}`, userId: memberId, title: '美甲消费', productType: '美甲', originalPrice: 99, finalPrice: 99, discountRate: 1, effectImages: [], orderDate: '2026-11-08', createdAt: '2026-11-08T00:00:00Z', createdBy: 'pospal', source: 'POSPAL' });
  const client = {
    getConfiguration: () => ({ accountSource: source, enabled: true, configured: true, memberSyncEnabled: false }),
    getAccount: () => 'photo-test-store',
    getConsumptions: jest.fn(async (uid: string, memberId: string) => [order(uid, memberId)]),
    createMember: jest.fn(), updateMemberNickname: jest.fn(),
  };
  const admin = () => ({ Authorization: `Bearer ${signToken('admin-001', 'admin')}`, 'x-admin-id': 'forged-admin' });
  const member = (id: string) => ({ Authorization: `Bearer ${signToken(id, 'member')}`, 'x-user-id': 'forged-id' });
  const path = (id = owner, orderId = 'pospal-101') => `/admin/members/${id}/consumptions/${orderId}/photos`;
  const upload = (count = 1, id = owner, orderId = 'pospal-101') => {
    let req = request(app.getHttpServer()).post(path(id, orderId)).set(admin());
    for (let i = 0; i < count; i++) req = req.attach('files', image, { filename: 'nail.png', contentType: 'image/png' });
    return req;
  };
  const list = (id = owner) => request(app.getHttpServer()).get('/consumptions/my').set(member(id)).expect(200);
  async function financialState() {
    return Promise.all([db.member.findMany({ orderBy: { id: 'asc' } }), db.pospalMemberLink.findMany({ orderBy: { memberId: 'asc' } }), db.consumptionOrder.findMany(), db.rechargeOrder.findMany(), db.balanceLedger.findMany(), db.pointsLedger.findMany()]);
  }
  beforeAll(async () => {
    process.env.MINIAPP_LOGIN_MODE = 'mock'; process.env.POSPAL_ACCOUNT_SOURCE = 'pospal'; process.env.POSPAL_MEMBER_SYNC_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PospalClientService).useValue(client).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useStaticAssets(getUploadDir(), { prefix: '/uploads/' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = moduleRef.get(PrismaService); store = moduleRef.get(DataStoreService);
    image = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#f7f4ef' } }).png().toBuffer();
  });
  beforeEach(async () => {
    source = 'pospal'; jest.clearAllMocks();
    client.getConsumptions.mockImplementation(async (uid, memberId) => [order(uid, memberId)]);
    await store.resetWithSeed();
    owner = (await store.loginByWechat({ code: 'photo-owner', openIdHint: 'photo-owner' })).id;
    other = (await store.loginByWechat({ code: 'photo-other', openIdHint: 'photo-other' })).id;
    await db.member.update({ where: { id: owner }, data: { balance: 345, points: 67 } });
    await db.pospalMemberLink.createMany({ data: [{ memberId: owner, account: 'photo-test-store', customerUid: '101', customerNumber: 'POS-101' }, { memberId: other, account: 'photo-test-store', customerUid: '202', customerNumber: 'POS-202' }] });
  });
  afterAll(async () => { if (app) await app.close(); process.env = previousEnv; });

  it('lets only admins attach photos to a verified member-owned sale, without touching accounting', async () => {
    for (const headers of [{}, member(owner)]) await request(app.getHttpServer()).post(path()).set(headers).attach('files', image, 'nail.png').expect(401);
    await upload(1, owner, 'pospal-202').expect(404);
    expect(await db.consumptionPhoto.count()).toBe(0);
    const before = await financialState();
    await upload(2).expect(201);
    expect(await financialState()).toEqual(before);
    expect(client.createMember).not.toHaveBeenCalled(); expect(client.updateMemberNickname).not.toHaveBeenCalled();
    expect(await db.auditLog.findFirst({ where: { action: 'consumption.photos.upload' } })).toMatchObject({ actorId: 'admin-001', metadata: { orderId: 'pospal-101', count: 2 } });
    const mine = await list();
    expect(mine.body[0].effectImages).toHaveLength(2);
    expect(mine.body[0].consumptionPhotos).toHaveLength(2);
    expect((await list(other)).body[0].effectImages).toEqual([]);
    const adminList = await request(app.getHttpServer()).get(`/admin/members/${owner}/consumptions`).set(admin()).expect(200);
    expect(adminList.body[0].effectImages).toEqual(mine.body[0].effectImages);
    const media = await request(app.getHttpServer()).get(mine.body[0].effectImages[0]).expect(200);
    expect(media.headers['content-type']).toMatch(/image\/jpeg/);
    expect(media.headers['cache-control']).toBe('private, no-store');
    expect((await sharp(media.body).metadata()).format).toBe('jpeg');
    expect((await sharp(media.body).metadata()).exif).toBeUndefined();
  });

  it('requires an untampered, unexpired photo-only signature and invalidates it after account rebinding', async () => {
    await upload().expect(201);
    const url = (await list()).body[0].effectImages[0];
    const parsed = new URL(url, 'http://test');
    await request(app.getHttpServer()).get(parsed.pathname).expect(404);
    await request(app.getHttpServer()).get(url.replace('signature=', 'signature=x')).expect(404);
    const expired = new URL(url, 'http://test'); expired.searchParams.set('expires', String(Math.floor(Date.now() / 1000) - 1));
    await request(app.getHttpServer()).get(expired.pathname + expired.search).expect(404);
    await db.member.update({ where: { id: owner }, data: { authVersion: { increment: 1 } } });
    await request(app.getHttpServer()).get(url).expect(404);
  });

  it('removes only the selected photo, revokes its old link, and preserves money and sibling photos', async () => {
    await upload(2).expect(201);
    const before = await financialState();
    const photos = (await list()).body[0].consumptionPhotos;
    await request(app.getHttpServer()).delete(`${path(other)}/${photos[0].id}`).set(admin()).expect(404);
    await request(app.getHttpServer()).delete(`${path()}/${photos[0].id}`).set(member(owner)).expect(401);
    await request(app.getHttpServer()).delete(`${path()}/${photos[0].id}`).set(admin()).expect(200);
    await request(app.getHttpServer()).get(photos[0].url).expect(404);
    await request(app.getHttpServer()).get(photos[1].url).expect(200);
    expect((await list()).body[0].effectImages).toHaveLength(1);
    expect(await financialState()).toEqual(before);
    expect((await db.consumptionPhoto.findUniqueOrThrow({ where: { id: photos[0].id } })).removedAt).not.toBeNull();
  });

  it('rejects damaged files as a whole batch and enforces the nine-photo limit under concurrent uploads', async () => {
    await request(app.getHttpServer()).post(path()).set(admin()).attach('files', image, 'good.png').attach('files', Buffer.from('not an image'), 'bad.png').expect(400);
    expect(await db.consumptionPhoto.count()).toBe(0);
    await upload(8).expect(201);
    const results = await Promise.all([upload(), upload()]);
    expect(results.map(result => result.status).sort()).toEqual([201, 400]);
    expect(await db.consumptionPhoto.count({ where: { removedAt: null } })).toBe(9);
  });

  it('does not display or serve previous POS account photos after the underlying member link changes', async () => {
    await upload().expect(201);
    const url = (await list()).body[0].effectImages[0];
    await db.pospalMemberLink.update({ where: { memberId: owner }, data: { customerUid: '303' } });
    expect((await list()).body[0].effectImages).toEqual([]);
    await request(app.getHttpServer()).get(url).expect(404);
  });

  it('rechecks POS ownership inside the upload transaction if a link changes during its network read', async () => {
    client.getConsumptions.mockImplementationOnce(async (uid, memberId) => {
      await db.pospalMemberLink.update({ where: { memberId }, data: { customerUid: '404' } });
      return [order(uid, memberId)];
    });
    await upload().expect(400);
    expect(await db.consumptionPhoto.count()).toBe(0);
  });

  it('supports existing local orders, keeps their legacy pictures, and does not expose them after deletion', async () => {
    source = 'local'; process.env.POSPAL_ACCOUNT_SOURCE = 'local';
    await db.consumptionOrder.create({ data: { id: 'local-nail', orderNo: 'LOCAL-1', userId: owner, title: '美甲', originalPrice: 99, finalPrice: 99, discountRate: 1, orderDate: '2026-11-08', createdBy: 'admin-001', createdAt: new Date(), effectImages: ['/uploads/legacy.jpg'] } });
    const before = await financialState();
    await upload(1, owner, 'local-nail').expect(201);
    expect(await financialState()).toEqual(before);
    const record = (await list()).body.find((item: { id: string }) => item.id === 'local-nail');
    expect(record.effectImages).toHaveLength(2); expect(record.effectImages[0]).toBe('/uploads/legacy.jpg');
    await upload(1, other, 'local-nail').expect(404);
    await db.consumptionOrder.delete({ where: { id: 'local-nail' } });
    await request(app.getHttpServer()).get(record.effectImages[1]).expect(404);
    process.env.POSPAL_ACCOUNT_SOURCE = 'pospal';
  });
});
