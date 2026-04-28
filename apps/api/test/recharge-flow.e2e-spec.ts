import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Recharge Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('apply -> approve -> member balance increased', async () => {
    const me = await request(app.getHttpServer()).get('/members/me').expect(200);
    const before = me.body.balance;
    const userId = me.body.id;

    const applied = await request(app.getHttpServer())
      .post('/recharges/apply')
      .set('x-user-id', userId)
      .send({ amount: 60 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/recharges/${applied.body.id}/approve`)
      .set('x-admin-id', 'admin-001')
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/members/me')
      .set('x-user-id', userId)
      .expect(200);

    expect(after.body.balance).toBe(before + 60);
  });

  it('admin creates consumption order -> member balance decreases', async () => {
    const me = await request(app.getHttpServer()).get('/members/me').expect(200);
    const userId = me.body.id;
    const before = me.body.balance;

    await request(app.getHttpServer())
      .post('/admin/orders')
      .set('x-admin-id', 'admin-001')
      .send({
        userId,
        title: '门店消费',
        originalPrice: 30,
        productType: '理疗',
        effectImages: ['/uploads/mock.jpg'],
        orderDate: '2026-04-09',
      })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/members/me')
      .set('x-user-id', userId)
      .expect(200);

    expect(after.body.balance).toBe(before - 30);

    const myConsumptions = await request(app.getHttpServer())
      .get('/consumptions/my')
      .set('x-user-id', userId)
      .expect(200);
    expect(myConsumptions.body.length).toBeGreaterThan(0);
  });
});
