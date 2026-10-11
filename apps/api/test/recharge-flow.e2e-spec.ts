import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataStoreService } from '../src/store/data-store.service';
import { mkdirSync, rmSync } from 'node:fs';
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
    if (app) {
      await app.close();
    }
    if (process.env.E2E_MANAGED_UPLOAD_DIR === 'true') {
      rmSync(getUploadDir(), { force: true, recursive: true });
    }
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
    expect(visibleBefore.body.some((item: { id: string }) => item.id === product.body.id)).toBe(
      true,
    );

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
    expect(visibleAfter.body.some((item: { id: string }) => item.id === product.body.id)).toBe(
      false,
    );
  });

  it('lets members leave messages and admins read and reply', async () => {
    const created = await request(app.getHttpServer())
      .post('/members/me/messages')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: '请问本周六还有鲜花取花时间吗？', requestId: 'e2e-message-request-001' })
      .expect(201);
    expect(created.body.content).toContain('鲜花');

    const unread = await request(app.getHttpServer())
      .get('/admin/messages?status=unread')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(unread.body.some((item: { id: string }) => item.id === created.body.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/admin/messages/${created.body.id}/read`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const replied = await request(app.getHttpServer())
      .post(`/admin/messages/${created.body.id}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reply: '可以，门店会联系您确认具体时间。' })
      .expect(201);
    expect(replied.body.reply).toContain('门店会联系');

    const memberMessages = await request(app.getHttpServer())
      .get('/members/me/messages')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(memberMessages.body).toEqual([
      expect.objectContaining({ id: created.body.id, reply: replied.body.reply }),
    ]);
  });

  it('keeps the same member and phone after logging in again', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/wechat/login').send({ code: 'renewed-wechat-code' }).expect(201);
    expect(login.body.user.id).toBe(userId);
    expect(login.body.user.phone).toBe('13800138001');
    await request(app.getHttpServer()).get('/admin/members')
      .set('Authorization', `Bearer ${memberToken}`).expect(401);
    await request(app.getHttpServer()).get('/members/me/messages').expect(401);
  });

  it('exposes only the signed-in members points ledger and links mixed recharges', async () => {
    await request(app.getHttpServer()).get('/members/me/points-ledger').expect(401);
    const me = await request(app.getHttpServer()).get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`).expect(200);
    const recharge = await request(app.getHttpServer()).post('/admin/recharges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId, amount: 15, points: 3, requestId: '10e026be-b776-4dc0-b5f4-f8c3461d14b1' }).expect(201);
    const ledger = await request(app.getHttpServer()).get('/members/me/points-ledger')
      .set('Authorization', `Bearer ${memberToken}`).expect(200);
    expect(ledger.body).toEqual(expect.arrayContaining([expect.objectContaining({
      changePoints: 3, afterPoints: me.body.points + 3, relatedOrderId: expect.any(String),
    })]));
    expect(recharge.body.points).toBe(me.body.points + 3);
    const orders = await request(app.getHttpServer()).get('/admin/recharges')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    const entry = ledger.body.find((item: { changePoints: number }) => item.changePoints === 3);
    expect(orders.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: entry.relatedOrderId, amount: 15 })]));
    process.env.MINIAPP_MOCK_OPEN_ID = 'points-privacy-member';
    const other = await request(app.getHttpServer()).post('/auth/wechat/login')
      .send({ code: 'points-privacy-code' }).expect(201);
    process.env.MINIAPP_MOCK_OPEN_ID = 'wx-openid-demo-001';
    const isolated = await request(app.getHttpServer()).get(`/members/me/points-ledger?userId=${userId}`)
      .set('Authorization', `Bearer ${other.body.token}`).set('x-user-id', userId).expect(200);
    expect(isolated.body).toEqual([]);
  });

  it.each(['NAIL', 'FLOWER'])('blocks past dates and restores disabled %s appointment dates', async (businessType) => {
    const payload = { businessType, appointmentDate: '2099-08-11', startTime: '10:00', endTime: '11:00' };
    await request(app.getHttpServer()).post('/members/me/appointments')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ ...payload, appointmentDate: '2000-01-01' }).expect(400);
    const blocked = await request(app.getHttpServer()).post('/admin/appointment-unavailable-dates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ appointmentDate: payload.appointmentDate, businessType, reason: '预约已满' }).expect(201);
    await request(app.getHttpServer()).post('/members/me/appointments')
      .set('Authorization', `Bearer ${memberToken}`).send(payload).expect(400);
    await request(app.getHttpServer()).delete(`/admin/appointment-unavailable-dates/${blocked.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    const appointment = await request(app.getHttpServer()).post('/members/me/appointments')
      .set('Authorization', `Bearer ${memberToken}`).send(payload).expect(201);
    const changed = await request(app.getHttpServer()).patch(`/admin/appointments/${appointment.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startTime: '14:00', endTime: '15:00', status: 'CONFIRMED' }).expect(200);
    expect(changed.body).toEqual(expect.objectContaining({ businessType, startTime: '14:00' }));
    const mine = await request(app.getHttpServer()).get('/members/me/appointments')
      .set('Authorization', `Bearer ${memberToken}`).expect(200);
    expect(mine.body).toContainEqual(expect.objectContaining({ id: appointment.body.id, startTime: '14:00' }));
    await request(app.getHttpServer()).delete(`/admin/appointments/${appointment.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
  });

  it.each(['NAIL', 'ACCESSORY', 'FLOWER'])('edits, hides and relists %s products with images', async (businessType) => {
    const uploaded = await request(app.getHttpServer()).post('/admin/uploads/images')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', TEST_PNG, { filename: 'catalog.png', contentType: 'image/png' }).expect(201);
    const category = await request(app.getHttpServer()).post(`/admin/catalog/${businessType}/categories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `回归分类-${businessType}` }).expect(201);
    const product = await request(app.getHttpServer()).post(`/admin/catalog/${businessType}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '回归产品', categoryId: category.body.id, images: uploaded.body.urls, referencePrice: 88 }).expect(201);
    const publicPath = `/members/catalog/${businessType}/products`;
    const listed = await request(app.getHttpServer()).get(publicPath).expect(200);
    expect(listed.body).toContainEqual(expect.objectContaining({ id: product.body.id, images: uploaded.body.urls }));
    await request(app.getHttpServer()).patch(`/admin/catalog/${businessType}/products/${product.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ isActive: false }).expect(200);
    const hidden = await request(app.getHttpServer()).get(publicPath).expect(200);
    expect(hidden.body.some((item: { id: string }) => item.id === product.body.id)).toBe(false);
    await request(app.getHttpServer()).patch(`/admin/catalog/${businessType}/products/${product.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ isActive: true, name: '重新上架' }).expect(200);
    const relisted = await request(app.getHttpServer()).get(publicPath).expect(200);
    expect(relisted.body).toContainEqual(expect.objectContaining({ id: product.body.id, name: '重新上架' }));
  });

  it('validates birthdays and prevents members from editing their ID', async () => {
    process.env.MINIAPP_MOCK_OPEN_ID = 'e2e-birthday-member';
    const login = await request(app.getHttpServer()).post('/auth/wechat/login')
      .send({ code: 'birthday-login' }).expect(201);
    process.env.MINIAPP_MOCK_OPEN_ID = 'wx-openid-demo-001';
    const auth = `Bearer ${login.body.token}`;
    await request(app.getHttpServer()).patch('/members/me').set('Authorization', auth)
      .send({ birthday: '02-30' }).expect(400);
    const profile = await request(app.getHttpServer()).patch('/members/me').set('Authorization', auth)
      .send({ birthday: '09-12', nickname: '生日日历测试' }).expect(200);
    expect(profile.body.birthday).toBe('09-12');
    await request(app.getHttpServer()).patch('/members/me').set('Authorization', auth)
      .send({ birthday: '09-13' }).expect(400);
    await request(app.getHttpServer()).patch('/members/me').set('Authorization', auth)
      .send({ id: 'MI-edited' }).expect(400);
    const member = await request(app.getHttpServer()).get(`/admin/members/${login.body.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(member.body).toEqual(expect.objectContaining({ birthday: '09-12', nickname: '生日日历测试' }));
    await request(app.getHttpServer()).delete(`/admin/members/${login.body.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app.getHttpServer()).get('/members/me').set('Authorization', auth).expect(401);
  });

  it('deletes a member appointment and voids a consumption order with a refund', async () => {
    const before = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    const order = await request(app.getHttpServer())
      .post('/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId, title: '可作废测试消费', originalPrice: 5, orderDate: '2026-04-11' })
      .expect(201);
    const afterCharge = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(afterCharge.body.balance).toBe(before.body.balance - 5);

    await request(app.getHttpServer())
      .delete(`/admin/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const afterVoid = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(afterVoid.body.balance).toBe(before.body.balance);

    const appointment = await request(app.getHttpServer())
      .post('/members/me/appointments')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ businessType: 'FLOWER', appointmentDate: '2099-04-10', startTime: '15:00' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/admin/appointments/${appointment.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
