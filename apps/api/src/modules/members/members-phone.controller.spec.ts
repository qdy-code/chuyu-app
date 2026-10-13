import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { signToken } from '../../common/token';
import { DataStoreService } from '../../store/data-store.service';
import { PrismaService } from '../../store/prisma.service';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';
import { PospalService } from '../pospal/pospal.service';
import { PospalClientService } from '../pospal/pospal-client.service';

describe('WeChat phone PUT compatibility with the existing member auth boundary', () => {
  let app: INestApplication;
  const resolvePhoneNumber = jest.fn();
  const updateMemberSelf = jest.fn();
  const cachedAccountProfile = jest.fn();
  const accountProfile = jest.fn();
  const profile = { id: 'member-owner', phone: '13800138000', balance: 10, points: 5 };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ member: { findUnique: async () => ({ deletedAt: null }) } })
      .overrideProvider(DataStoreService).useValue({ updateMemberSelf })
      .overrideProvider(WechatMiniappService).useValue({ resolvePhoneNumber })
      .overrideProvider(PospalService).useValue({ cachedAccountProfile, accountProfile })
      .overrideProvider(PospalClientService).useValue({
        getConfiguration: () => ({ enabled: false, configured: false, readOnly: true, missingEnv: [] }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    resolvePhoneNumber.mockResolvedValue(profile.phone);
    updateMemberSelf.mockResolvedValue({ member: profile });
    cachedAccountProfile.mockResolvedValue(profile);
    accountProfile.mockResolvedValue(profile);
  });
  afterAll(async () => { await app.close(); });

  it.each(['put', 'patch'] as const)('%s rejects unauthenticated calls before exchanging a phone code', async (method) => {
    await request(app.getHttpServer())[method]('/members/me/phone')
      .set('x-user-id', 'forged-member').send({ code: 'phone-code' }).expect(401);
    expect(resolvePhoneNumber).not.toHaveBeenCalled();
    expect(updateMemberSelf).not.toHaveBeenCalled();
  });

  it.each(['put', 'patch'] as const)('%s binds only the signed-in member and uses the existing cached POS projection', async (method) => {
    const response = await request(app.getHttpServer())[method]('/members/me/phone')
      .set('Authorization', `Bearer ${signToken('member-owner', 'member')}`)
      .set('x-user-id', 'victim-member').send({ code: 'phone-code' }).expect(200);
    expect(resolvePhoneNumber).toHaveBeenCalledTimes(1);
    expect(resolvePhoneNumber).toHaveBeenCalledWith('phone-code', undefined);
    expect(updateMemberSelf).toHaveBeenCalledWith('member-owner', { phone: profile.phone }, process.env.MINIAPP_LOGIN_MODE !== 'mock');
    expect(cachedAccountProfile).toHaveBeenCalledWith('member-owner');
    expect(response.body).toEqual(profile);
  });

  it('PUT retains input validation and duplicate-phone rejection', async () => {
    const headers = { Authorization: `Bearer ${signToken('member-owner', 'member')}` };
    await request(app.getHttpServer()).put('/members/me/phone').set(headers).send({ code: '' }).expect(400);
    expect(resolvePhoneNumber).not.toHaveBeenCalled();
    updateMemberSelf.mockResolvedValueOnce({ reason: 'phone already bound by another member' });
    await request(app.getHttpServer()).put('/members/me/phone').set(headers).send({ code: 'phone-code' }).expect(400);
    expect(cachedAccountProfile).not.toHaveBeenCalled();
  });

  it('cached profile reads stay within member auth and cannot trigger the paid account read', async () => {
    await request(app.getHttpServer()).get('/members/me/cached-profile').set('x-user-id', 'victim-member').expect(401);
    expect(cachedAccountProfile).not.toHaveBeenCalled();
    const response = await request(app.getHttpServer()).get('/members/me/cached-profile')
      .set('Authorization', `Bearer ${signToken('member-owner', 'member')}`)
      .set('x-user-id', 'victim-member').expect(200);
    expect(cachedAccountProfile).toHaveBeenCalledWith('member-owner');
    expect(accountProfile).not.toHaveBeenCalled();
    expect(response.body).toEqual(profile);
    await request(app.getHttpServer()).get('/members/me')
      .set('Authorization', `Bearer ${signToken('member-owner', 'member')}`).expect(200);
    expect(accountProfile).toHaveBeenCalledWith('member-owner');
  });
});
