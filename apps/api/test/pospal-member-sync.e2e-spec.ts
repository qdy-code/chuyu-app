import { BadGatewayException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/store/prisma.service';
import { DataStoreService } from '../src/store/data-store.service';
import { signToken } from '../src/common/token';
import { PospalClientService, PospalMemberUnavailableException } from '../src/modules/pospal/pospal-client.service';
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

  const adminAuth = () => ({ Authorization: `Bearer ${signToken('admin-001', 'admin')}` });
  async function createOffline(confirmed = true) {
    index += 1;
    const phone = `138${String(index).padStart(8, '0')}`;
    const response = await request(app.getHttpServer()).post('/admin/members').set(adminAuth())
      .set('x-admin-id', 'forged-admin').send({ nickname: `线下会员${index}`, phone, identityVerified: confirmed }).expect(201);
    client.getMemberByUid.mockImplementation(async (uid: string) => ({ uid, phone, number: `MP${response.body.id}`, balance: 0, points: 0, levelName: '会员', discountRate: 1 }));
    return { ...response.body, phone };
  }

  it('queues store-confirmed creation atomically without granting WeChat phone verification or making POS calls', async () => {
    const member = await createOffline();
    expect(await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).toMatchObject({ phoneVerifiedAt: null, phoneStoreVerifiedAt: expect.any(Date) });
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'PENDING', customerNumber: `MP${member.id}` });
    expect(await prisma.auditLog.findFirst({ where: { targetId: member.id, action: 'member.create' } })).toMatchObject({ actorId: 'admin-001', metadata: expect.objectContaining({ verification: 'STORE' }) });
    expect(client.findMembersByPhone).not.toHaveBeenCalled();
    expect(client.createMember).not.toHaveBeenCalled();
    await worker.processNext();
    expect(client.createMember).toHaveBeenCalledWith(`MP${member.id}`, member.phone, member.nickname);
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'DONE' });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).toMatchObject({ balance: 0, points: 0, phoneVerifiedAt: null });
  });

  it('keeps unconfirmed or phone-less creation local and rejects malformed confirmation', async () => {
    const member = await createOffline(false);
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toBeNull();
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).phoneStoreVerifiedAt).toBeNull();
    const response = await request(app.getHttpServer()).post('/admin/members').set(adminAuth()).send({ nickname: '无手机档案' }).expect(201);
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: response.body.id } })).toBeNull();
    await request(app.getHttpServer()).post('/admin/members').set(adminAuth()).send({ nickname: '无效确认', identityVerified: true }).expect(400);
    await request(app.getHttpServer()).post('/admin/members').set(adminAuth()).send({ nickname: '无效字段', identityVerified: 'true' }).expect(400);
  });

  it('repairs only the selected offline member through explicit authenticated store confirmation', async () => {
    const member = await createOffline(false);
    const untouched = await createOffline(false);
    const path = `/admin/pospal/members/${member.id}/sync`;
    for (const token of ['', signToken(member.id, 'member')]) {
      await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`).send({ identityVerified: true }).expect(401);
    }
    for (const body of [{}, { identityVerified: false }, { identityVerified: true, phone: '13999999999' }]) {
      await request(app.getHttpServer()).post(path).set(adminAuth()).send(body).expect(400);
    }
    await request(app.getHttpServer()).post(path).set(adminAuth()).send({ identityVerified: true }).expect(201);
    await request(app.getHttpServer()).post(path).set(adminAuth()).send({ identityVerified: true }).expect(201);
    expect(await prisma.pospalMemberSync.count({ where: { memberId: member.id } })).toBe(1);
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: untouched.id } })).toBeNull();
    expect((await prisma.member.findUniqueOrThrow({ where: { id: untouched.id } })).phoneStoreVerifiedAt).toBeNull();
    expect(client.createMember).not.toHaveBeenCalled();
    await prisma.pospalMemberSync.update({ where: { memberId: member.id }, data: { state: 'RUNNING' } });
    await request(app.getHttpServer()).post(path).set(adminAuth()).send({ identityVerified: true }).expect(400);
  });

  it('clears store confirmation on phone change and prevents an old queued job from creating a POS account', async () => {
    const member = await createOffline();
    await store.updateMemberSelf(member.id, { phone: '13700001234' });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).phoneStoreVerifiedAt).toBeNull();
    await worker.processNext();
    expect(client.createMember).not.toHaveBeenCalled();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'REVIEW' });
  });

  it('cannot overwrite a concurrent worker lease when store confirmation was waiting on its row lock', async () => {
    const member = await createOffline();
    let unlock!: () => void;
    let locked!: () => void;
    const gate = new Promise<void>(resolve => { unlock = resolve; });
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const claim = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "memberId" FROM "PospalMemberSync" WHERE "memberId" = ${member.id} FOR UPDATE`;
      await tx.pospalMemberSync.update({ where: { memberId: member.id }, data: { state: 'RUNNING', leaseUntil: new Date(Date.now() + 120_000) } });
      locked();
      await gate;
    });
    await ready;
    const confirmation = worker.confirmAndQueue(member.id, 'admin-001', true).then(() => 'queued', () => 'rejected');
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const rows = await prisma.$queryRaw<{ waiting: bigint }[]>`SELECT count(*) AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%PospalMemberSync%'`;
        if (Number(rows[0].waiting)) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
    } finally { unlock(); await claim; }
    expect(await confirmation).toBe('rejected');
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'RUNNING', leaseUntil: expect.any(Date) });
    expect(client.createMember).not.toHaveBeenCalled();
  });

  it('does not auto-link an existing POS phone; manual linking and later WeChat binding preserve the original account and history', async () => {
    const member = await createOffline();
    client.findMembersByPhone.mockResolvedValue({ candidates: [{ uid: '991', number: 'ORIGINAL', balance: 800 }], hasMore: false });
    await worker.processNext();
    expect(client.createMember).not.toHaveBeenCalled();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'REVIEW' });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).balance).toBe(0);
    client.getMemberByUid.mockResolvedValue({ uid: '991', phone: member.phone, number: 'ORIGINAL', balance: 800, points: 125, levelName: '会员', discountRate: 1 });
    await request(app.getHttpServer()).post(`/admin/pospal/members/${member.id}/link`).set(adminAuth()).send({ customerUid: '991', identityVerified: true }).expect(201);
    const originalLink = await prisma.pospalMemberLink.findUniqueOrThrow({ where: { memberId: member.id } });
    const originalMember = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    const order = await prisma.rechargeOrder.create({ data: { id: `offline-history-${index}`, userId: member.id, amount: 800, status: 'APPROVED', createdAt: new Date(), updatedAt: new Date() } });
    const source = await store.loginByWechat({ code: `offline-bind-${index}`, openIdHint: `offline-bind-${index}` });
    const proof = await store.preparePhoneRecovery(source.id, member.phone);
    expect(proof.mode).toBe('STORE_REVIEW');
    await expect(store.confirmPhoneRecovery(source.id, proof.code)).rejects.toThrow();
    const result = await request(app.getHttpServer()).post(`/admin/members/${member.id}/wechat-link`).set(adminAuth()).send({ code: proof.code, verifiedPhone: member.phone, identityVerified: true }).expect(201);
    expect(result.body).toMatchObject({ id: member.id, balance: 800, points: 125, nickname: member.nickname });
    const after = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect({ ...after, openId: originalMember.openId, authVersion: originalMember.authVersion }).toEqual(originalMember);
    expect(await prisma.pospalMemberLink.findUniqueOrThrow({ where: { memberId: member.id } })).toEqual(originalLink);
    expect(await prisma.rechargeOrder.findUniqueOrThrow({ where: { id: order.id } })).toEqual(order);
    await request(app.getHttpServer()).get('/members/me').set('Authorization', `Bearer ${signToken(source.id, 'member')}`).expect(401);
    expect(client.createMember).not.toHaveBeenCalled();
  });

  it('rolls back the new member if persisting the matching sync task fails', async () => {
    const collisionId = 'OFFLINE-ATOMIC';
    const other = await createOffline();
    await prisma.pospalMemberSync.update({ where: { memberId: other.id }, data: { customerNumber: `MP${collisionId}` } });
    await expect(store.createMember({ id: collisionId, nickname: '事务测试', phone: '13700005678', identityVerified: true })).rejects.toThrow();
    expect(await prisma.member.findUnique({ where: { id: collisionId } })).toBeNull();
  });

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

  it('links a unique existing POS member after WeChat phone verification and uses its original account', async () => {
    const member = await register();
    const snapshot = { uid: '77', number: 'OLD', phone: member.phone, balance: 800, points: 125, levelName: '金卡', discountRate: 0.9 };
    client.findMembersByPhone.mockResolvedValue({ candidates: [{ uid: '77', number: 'OLD', balance: 1 }], hasMore: false });
    client.getMemberByUid.mockResolvedValue(snapshot);
    await prisma.pospalMemberSync.update({ where: { memberId: member.id }, data: { state: 'REVIEW' } });
    await worker.retry(member.id, 'admin-001');
    await worker.processNext();
    expect(client.createMember).not.toHaveBeenCalled();
    expect(client.updateMemberNickname).not.toHaveBeenCalled();
    expect(await prisma.pospalMemberLink.findUnique({ where: { memberId: member.id } })).toMatchObject({ customerUid: '77', customerNumber: 'OLD', account: 'sync-store' });
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'DONE', customerUid: '77', leaseUntil: null, lastError: null });
    const profile = await request(app.getHttpServer()).get('/members/me/cached-profile')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`).expect(200);
    expect(profile.body).toMatchObject({ balance: 800, points: 125, pospal: { state: 'LINKED', customerNumber: 'OLD' } });
    expect(await prisma.auditLog.findFirst({ where: { targetId: member.id, action: 'pospal.member.link.auto' } }))
      .toMatchObject({ metadata: expect.objectContaining({ customerUid: '77', verification: 'WECHAT_PHONE' }) });
  });

  it('rechecks an offline sync job after first WeChat login and links its existing POS member', async () => {
    const offline = await createOffline();
    const match = { uid: '661', number: 'EXISTING-661' };
    client.findMembersByPhone.mockResolvedValue({ candidates: [match], hasMore: false });
    await worker.processNext();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: offline.id } })).toMatchObject({ state: 'REVIEW' });
    const source = await store.loginByWechat({ code: 'first-offline-login' });
    const confirmed = await store.updateMemberSelf(source.id, { phone: offline.phone }, true, true);
    expect(confirmed.member?.id).toBe(offline.id);
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: offline.id } })).toMatchObject({ state: 'PENDING', attempts: 0, lastError: null });
    client.getMemberByUid.mockResolvedValue({ ...match, phone: offline.phone, balance: 15, points: 1, levelName: '会员', discountRate: 1 });
    await worker.processNext();
    expect(await prisma.pospalMemberLink.findUnique({ where: { memberId: offline.id } })).toMatchObject({ customerUid: match.uid, customerNumber: match.number });
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: offline.id } })).toMatchObject({ state: 'DONE' });
    expect(client.createMember).not.toHaveBeenCalled();
  });

  it.each(['multiple', 'incomplete', 'inactive', 'phone-changed', 'already-linked'])(
    'keeps a %s POS match for review without opening or moving an account',
    async (scenario) => {
    const member = await register();
    const candidate = { uid: '78', number: 'OLD-78' };
    client.findMembersByPhone.mockResolvedValue({
      candidates: scenario === 'multiple' ? [candidate, { uid: '79', number: 'OLD-79' }] : [candidate],
      hasMore: scenario === 'incomplete',
    });
    client.getMemberByUid.mockResolvedValue({
      ...candidate, phone: scenario === 'phone-changed' ? '13000000000' : member.phone,
      balance: 800, points: 125, levelName: '金卡', discountRate: 0.9,
    });
    if (scenario === 'inactive') client.getMemberByUid.mockRejectedValueOnce(new PospalMemberUnavailableException('银豹会员已停用'));
    if (scenario === 'already-linked') {
      const another = await createOffline(false);
      client.getMemberByUid.mockResolvedValue({ ...candidate, phone: member.phone, balance: 800, points: 125, levelName: '金卡', discountRate: 0.9 });
      await prisma.pospalMemberLink.create({ data: { memberId: another.id, customerUid: '78', customerNumber: candidate.number, account: 'sync-store' } });
    }
    await worker.processNext();
    expect(client.createMember).not.toHaveBeenCalled();
    expect(client.updateMemberNickname).not.toHaveBeenCalled();
    expect(await prisma.pospalMemberLink.findUnique({ where: { memberId: member.id } })).toBeNull();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'REVIEW' });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).balance).toBe(0);
    if (scenario === 'already-linked') {
      await prisma.pospalMemberLink.delete({ where: { customerUid: '78' } });
    }
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

  it('stops automatic retries for unsupported characters and shows a safe actionable error without changing the profile', async () => {
    const member = await register();
    const before = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    client.createMember.mockRejectedValueOnce(new BadGatewayException('银豹不支持会员资料中的部分特殊字符，请求编号 safe-test-id'));
    await worker.processNext();
    expect(await prisma.pospalMemberSync.findUnique({ where: { memberId: member.id } })).toMatchObject({ state: 'FAILED', attempts: 1, lastError: expect.stringContaining('特殊字符') });
    await worker.processNext(); expect(client.createMember).toHaveBeenCalledTimes(1);
    expect(await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).toEqual(before);
    expect(await prisma.pospalMemberLink.findUnique({ where: { memberId: member.id } })).toBeNull();
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
