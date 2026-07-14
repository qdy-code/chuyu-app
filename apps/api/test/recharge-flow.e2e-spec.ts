import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataStoreService } from '../src/store/data-store.service';
import { mkdirSync } from 'node:fs';
import { getUploadDir } from '../src/config/upload-path';

const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('Recharge Flow (e2e)', () => {
  let app: INestApplication;
  let memberToken: string;
  let adminToken: string;
  let userId: string;

  beforeAll(async () => {
    process.env.MINIAPP_LOGIN_MODE = 'mock';
    process.env.MINIAPP_MOCK_OPEN_ID = 'wx-openid-demo-001';
    process.env.ADMIN_PASSWORD = 'e2e-admin-password';
    process.env.JWT_SECRET = 'e2e-jwt-secret-with-at-least-thirty-two-characters';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    mkdirSync(getUploadDir(), { recursive: true });

    await app.get(DataStoreService).resetWithSeed();
    const memberLogin = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'e2e-member-code' })
      .expect(201);
    memberToken = memberLogin.body.token;
    userId = memberLogin.body.user.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ password: process.env.ADMIN_PASSWORD })
      .expect(201);
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires a valid member token', async () => {
    await request(app.getHttpServer()).get('/members/me').expect(401);
  });

  it('admin recharge increases member balance', async () => {
    const me = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    const before = me.body.balance;

    await request(app.getHttpServer())
      .post('/admin/recharges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId, amount: 60, points: 6, remark: 'e2e recharge' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(after.body.balance).toBe(before + 60);
    expect(after.body.points).toBe(me.body.points + 6);
  });

  it('admin creates consumption order -> member balance decreases', async () => {
    const me = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    const before = me.body.balance;

    const uploaded = await request(app.getHttpServer())
      .post('/admin/uploads/images')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', TEST_PNG, { filename: 'effect.png', contentType: 'image/png' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId,
        title: '门店消费',
        originalPrice: 30,
        productType: '理疗',
        effectImages: uploaded.body.urls,
        orderDate: '2026-04-09',
      })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(after.body.balance).toBe(before - 30);

    const myConsumptions = await request(app.getHttpServer())
      .get('/consumptions/my')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(myConsumptions.body.length).toBeGreaterThan(0);
  });

  it('updates avatar and prevents duplicate phone binding', async () => {
    const avatar = await request(app.getHttpServer())
      .post('/members/me/avatar')
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('file', TEST_PNG, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);
    expect(avatar.body.avatarUrl).toMatch(/^\/uploads\/avatar-.*\.jpg$/);

    const adminMember = await request(app.getHttpServer())
      .get(`/admin/members/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminMember.body.avatarUrl).toBe(avatar.body.avatarUrl);

    await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ avatarUrl: 'https://example.com/untrusted-avatar.jpg' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/admin/members/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: 'MI999999999999' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ phone: '13800138001', nickname: '测试会员' })
      .expect(200);

    process.env.MINIAPP_MOCK_OPEN_ID = 'e2e-second-openid';
    const secondLogin = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'e2e-second-code' })
      .expect(201);
    process.env.MINIAPP_MOCK_OPEN_ID = 'wx-openid-demo-001';

    const duplicated = await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${secondLogin.body.token}`)
      .send({ phone: '13800138001' })
      .expect(400);
    expect(JSON.stringify(duplicated.body)).toContain('phone already bound by another member');
  });

  it('uploads a product image and hides an accessory after acceptance', async () => {
    const uploaded = await request(app.getHttpServer())
      .post('/admin/uploads/images')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', TEST_PNG, { filename: 'product.png', contentType: 'image/png' })
      .expect(201);
    expect(uploaded.body.urls[0]).toMatch(/^\/uploads\/.*\.jpg$/);

    const category = await request(app.getHttpServer())
      .post('/admin/catalog/ACCESSORY/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '送审测试分类', sortOrder: 999 })
      .expect(201);
    const product = await request(app.getHttpServer())
      .post('/admin/catalog/ACCESSORY/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId: category.body.id,
        name: '送审测试饰品',
        referencePrice: 100,
        images: uploaded.body.urls,
        isActive: true,
      })
      .expect(201);

    const visibleBefore = await request(app.getHttpServer())
      .get('/members/catalog/ACCESSORY/products')
      .expect(200);
    expect(visibleBefore.body.some((item: { id: string }) => item.id === product.body.id)).toBe(true);

    const appointment = await request(app.getHttpServer())
      .post('/members/me/appointments')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        businessType: 'ACCESSORY',
        productId: product.body.id,
        appointmentDate: '2099-03-10',
        startTime: '14:00',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/admin/appointments/${appointment.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    const visibleAfter = await request(app.getHttpServer())
      .get('/members/catalog/ACCESSORY/products')
      .expect(200);
    expect(visibleAfter.body.some((item: { id: string }) => item.id === product.body.id)).toBe(false);
  });
});
