import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { signToken } from '../../common/token';
import { DataStoreService } from '../../store/data-store.service';
import { PrismaService } from '../../store/prisma.service';
import { PospalClientService } from './pospal-client.service';
import { PospalService } from './pospal.service';

describe('Pospal controller authentication (actual AppModule, mocked storage and platform)', () => {
  let app: INestApplication;
  const checkConnection = jest.fn();
  const previewMember = jest.fn();
  const linkMember = jest.fn();
  const accountProfile = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ member: { findUnique: async () => ({ deletedAt: null }) } })
      .overrideProvider(DataStoreService).useValue({})
      .overrideProvider(PospalClientService).useValue({
        getConfiguration: () => ({ enabled: false, configured: false, readOnly: true, missingEnv: [] }),
        checkConnection,
      })
      .overrideProvider(PospalService).useValue({ previewMember, linkMember, accountProfile })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('blocks every new route for anonymous and member sessions', async () => {
    const memberToken = signToken('member-1', 'member');
    for (const token of ['', memberToken]) {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await request(app.getHttpServer()).get('/admin/pospal/status').set(headers).expect(401);
      await request(app.getHttpServer()).post('/admin/pospal/connection-test').set(headers).expect(401);
      await request(app.getHttpServer()).post('/admin/pospal/members/MI1/preview').set(headers).expect(401);
      await request(app.getHttpServer()).post('/admin/pospal/members/MI1/link').set(headers).send({ customerUid: '101', identityVerified: true }).expect(401);
    }
    expect(checkConnection).not.toHaveBeenCalled();
    expect(previewMember).not.toHaveBeenCalled();
    expect(linkMember).not.toHaveBeenCalled();
  });

  it('allows administrators and ignores client credentials or store scope', async () => {
    const headers = { Authorization: `Bearer ${signToken('admin-1', 'admin')}` };
    await request(app.getHttpServer()).get('/admin/pospal/status').set(headers).expect(200);
    checkConnection.mockResolvedValueOnce({ stores: [], hasMore: false });
    await request(app.getHttpServer()).post('/admin/pospal/connection-test').set(headers)
      .send({ account: 'another-store', appKey: 'untrusted-key' }).expect(201);
    expect(checkConnection).toHaveBeenCalledWith();
    previewMember.mockResolvedValueOnce({ state: 'NO_PHONE' });
    await request(app.getHttpServer()).post('/admin/pospal/members/MI1/preview').set(headers).expect(201);
    expect(previewMember).toHaveBeenCalledWith('MI1');
    await request(app.getHttpServer()).post('/admin/pospal/members/MI1/link').set(headers).send({ customerUid: '101', identityVerified: false }).expect(400);
    await request(app.getHttpServer()).post('/admin/pospal/members/MI1/link').set(headers).send({ customerUid: 101, identityVerified: true }).expect(400);
    linkMember.mockResolvedValueOnce({ customerNumber: 'VIP1' });
    await request(app.getHttpServer()).post('/admin/pospal/members/MI1/link').set(headers).send({ customerUid: '101', identityVerified: true }).expect(201);
    expect(linkMember).toHaveBeenCalledWith('MI1', '101', 'admin-1', true);
  });

  it('ignores forged user IDs when reading a signed-in members balance', async () => {
    accountProfile.mockResolvedValueOnce({ id: 'member-owner', balance: 10, points: 5 });
    await request(app.getHttpServer()).get('/members/me')
      .set('Authorization', `Bearer ${signToken('member-owner', 'member')}`)
      .set('x-user-id', 'victim-member').expect(200);
    expect(accountProfile).toHaveBeenCalledWith('member-owner');
  });
});
