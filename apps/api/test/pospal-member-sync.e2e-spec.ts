import { BadGatewayException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/store/prisma.service';
import { DataStoreService } from '../src/store/data-store.service';
import { signToken } from '../src/common/token';
import { PospalClientService } from '../src/modules/pospal/pospal-client.service';
import { PospalMemberSyncService } from '../src/modules/pospal/pospal-member-sync.service';
import { WechatMiniappService } from '../src/modules/wechat/wechat-miniapp.service';

describe('Durable member registration sync (isolated PostgreSQL, simulated Pospal)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let store: DataStoreService;
  let worker: PospalMemberSyncService;
  let enabled = false;
  let index = 0;
  const previousEnv = { ...process.env };
  const client = {
    getConfiguration: () => ({ enabled: true, configured: true, accountSource: 'pospal', memberSyncEnabled: enabled }),
    getAccount: () => 'sync-store',
    findMemberByNumber: jest.fn(), findMembersByPhone: jest.fn(), createMember: jest.fn(),
    getMemberByUid: jest.fn(), updateMemberNickname: jest.fn(),
  };
  beforeAll(async () => {
    process.env.POSPAL_ACCOUNT_SOURCE = 'pospal';
    process.env.POSPAL_ACCOUNT = 'sync-store';
    process.env.MINIAPP_LOGIN_MODE = 'real';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PospalClientService).useValue(client)
      .overrideProvider(WechatMiniappService).useValue({ resolvePhoneNumber: async () => '13999999999' })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService); store = moduleRef.get(DataStoreService); worker = moduleRef.get(PospalMemberSyncService);
    await store.resetWithSeed();
  });
  beforeEach(async () => {
    jest.clearAllMocks(); enabled = true;
    await prisma.pospalMemberSync.deleteMany();
    client.findMemberByNumber.mockResolvedValue(null);
    client.findMembersByPhone.mockResolvedValue({ candidates: [], hasMore: false });
    client.createMember.mockResolvedValue(String(1000 + index));
  });
  afterAll(async () => { if (app) await app.close(); process.env = previousEnv; });

  async function register(verified = true) {
    index += 1;
    const member = await store.loginByWechat({ code: `sync-${index}`, openIdHint: `sync-${index}` });
    const phone = `139${String(index).padStart(8, '0')}`;
    await store.updateMemberSelf(member.id, { phone, nickname: `会员${index}` }, verified);
    client.getMemberByUid.mockImplementation(async (uid: string) => ({ uid, phone, number: `MP${member.id}`, balance: 0, points: 0, levelName: '会员', discountRate: 1 }));
    return { ...member, phone };
  }

  it('atomically persists registration and its job without contacting POS; manual input does not grant phone verification', async () => {
    const member = await register(false);
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toBeNull();
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).phoneVerifiedAt).toBeNull();
    const response = await request(app.getHttpServer()).patch('/members/me/phone')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`).send({ code: 'simulated-code' }).expect(200);
    expect(response.body.pospal.memberSync.state).toBe('PENDING');
    expect(client.createMember).not.toHaveBeenCalled();
    expect(client.findMembersByPhone).not.toHaveBeenCalled();
  });

  it('creates and links a new POS member, reads real funds, and only sends nickname updates subsequently', async () => {
    const member = await register();
    await worker.processNext();
    expect(client.createMember).toHaveBeenCalledWith(`MP${member.id}`, member.phone, `会员${index}`);
    expect(await prisma.pospalMemberLink.findUnique({ where: { memberId: member.id } })).toMatchObject({ customerNumber: `MP${member.id}`, account: 'sync-store', lastSyncedAt: expect.any(Date) });
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'DONE' });
    await store.updateMemberSelf(member.id, { nickname: '新的昵称' });
    await worker.processNext();
    expect(client.updateMemberNickname).toHaveBeenCalledWith(String(1000 + index - 1), '新的昵称');
    expect(client.createMember).toHaveBeenCalledTimes(1);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).balance).toBe(0);
    await expect(store.updateMemberSelf(member.id, { phone: '13888888888' }, true)).resolves.toMatchObject({ reason: expect.stringContaining('门店核对') });
  });

  it('leaves an existing phone member for identity review without creating or exposing funds', async () => {
    const member = await register();
    client.findMembersByPhone.mockResolvedValue({ candidates: [{ uid: '77', number: 'OLD', balance: 800 }], hasMore: false });
    await worker.processNext();
    expect(client.createMember).not.toHaveBeenCalled();
    expect(await prisma.pospalMemberLink.findUnique({ where: { memberId: member.id } })).toBeNull();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'REVIEW' });
  });

  it('recovers an uncertain create response by fixed number without creating twice', async () => {
    const member = await register();
    client.createMember.mockRejectedValueOnce(new BadGatewayException('timeout'));
    await worker.processNext();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'PENDING', createAttemptedAt: expect.any(Date) });
    await worker.retry(member.id, 'admin-001');
    client.findMemberByNumber.mockResolvedValue({ uid: '88', number: `MP${member.id}`, phone: member.phone });
    await worker.processNext();
    expect(client.createMember).toHaveBeenCalledTimes(1);
    expect(await prisma.pospalMemberLink.findUnique({ where: { memberId: member.id } })).toMatchObject({ customerUid: '88' });
  });

  it('refuses pre-existing number collisions even when the phone matches', async () => {
    const member = await register();
    client.findMemberByNumber.mockResolvedValue({ uid: '89', number: `MP${member.id}`, phone: member.phone });
    await worker.processNext();
    expect(client.createMember).not.toHaveBeenCalled();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'REVIEW' });
  });

  it('recovers expired leases and retains profile changes arriving while sync is running', async () => {
    const member = await register();
    await prisma.pospalMemberSync.update({ where: { memberId: member.id }, data: { state: 'RUNNING', leaseUntil: new Date(0) } });
    client.createMember.mockImplementationOnce(async () => {
      await store.updateMemberSelf(member.id, { nickname: '期间修改' });
      return '99';
    });
    await worker.processNext();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'PENDING' });
    await worker.processNext();
    expect(client.updateMemberNickname).toHaveBeenCalledWith('99', '期间修改');
  });

  it('protects repair routes with admin authentication', async () => {
    for (const token of ['', signToken('someone', 'member')]) {
      await request(app.getHttpServer()).get('/admin/pospal/member-sync').set('Authorization', `Bearer ${token}`).expect(401);
      await request(app.getHttpServer()).post('/admin/pospal/member-sync/ANY/retry').set('Authorization', `Bearer ${token}`).expect(401);
    }
    await request(app.getHttpServer()).get('/admin/pospal/member-sync').set('Authorization', `Bearer ${signToken('admin-001', 'admin')}`).expect(200);
  });

  it('stops retries and opens a circuit for account service suspension while registration still succeeds', async () => {
    const member = await register();
    client.findMemberByNumber.mockRejectedValueOnce(new BadGatewayException('银豹 Token 余额不足或正式服务已暂停'));
    await worker.processNext();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'FAILED' });
    await worker.retry(member.id, 'admin-001');
    await worker.processNext();
    expect(client.findMemberByNumber).toHaveBeenCalledTimes(1);
    const another = await register();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: another.id } })).toMatchObject({ state: 'PENDING' });
  });
});
