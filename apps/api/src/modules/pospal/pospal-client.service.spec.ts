import { createHash } from 'node:crypto';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { PospalClientService } from './pospal-client.service';

describe('PospalClientService', () => {
  let client: PospalClientService;
  let fetchMock: jest.SpyInstance;
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.POSPAL_ENABLED = 'true';
    process.env.POSPAL_APP_ID = 'test-app';
    process.env.POSPAL_APP_KEY = 'test-key';
    process.env.POSPAL_ACCOUNT = 'test-store';
    client = new PospalClientService();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    process.env = { ...previousEnv };
    jest.restoreAllMocks();
  });

  function page(list: unknown[], hasMore = false) {
    return new Response(JSON.stringify({ status: 'success', errorCode: 0, result: { list, hasMore } }));
  }

  it('signs a real-format request and fixes the scope to server configuration', async () => {
    fetchMock.mockResolvedValue(page([{ userId: '6141954', company: 'test-store', self: true }]));
    const result = await client.checkConnection();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://platform.pospal.cn/openapi/v3/user/page');
    expect(init.redirect).toBe('error');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ account: 'test-store', lastId: 0, limit: 1, order: 'asc' });
    const expected = createHash('md5').update(`test-app|${headers['X-Request-Id']}|${headers['X-Timestamp']}|test-key`).digest('hex').toUpperCase();
    expect(headers['X-Sign']).toBe(expected);
    expect(result.stores[0].userId).toBe('6141954');
    expect(JSON.stringify(result)).not.toContain('test-key');
  });

  it('does not call the platform while disabled or incompletely configured', async () => {
    process.env.POSPAL_ENABLED = 'false';
    await expect(client.checkConnection()).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.POSPAL_ENABLED = 'true';
    delete process.env.POSPAL_APP_KEY;
    await expect(client.checkConnection()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.getConfiguration().missingEnv).toEqual(['POSPAL_APP_KEY']);
    expect(JSON.stringify(client.getConfiguration())).not.toContain('test-app');
  });

  it('treats HTTP 200 business errors as failure without echoing upstream secrets', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'error', errorCode: 4021, messages: ['test-key sensitive member'] })));
    const error = await client.checkConnection().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(String(error)).toContain('Token');
    expect(String(error)).not.toContain('test-key');
    expect(String(error)).not.toContain('sensitive member');
  });

  it('normalizes only outgoing POS labels and keeps Chinese names and original profile input intact', async () => {
    process.env.POSPAL_MEMBER_SYNC_ENABLED = 'true';
    const original = '小美🧸 e\u0301';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'success', errorCode: 0, result: { uid: '123', number: 'TEST-1', tel: '13988889999' } })));
    await client.createMember('TEST-1', '13988889999', original);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.name).toBe('小美 é'); expect(body.customerExt.nickName).toBe('小美 é');
    expect(body.point).toBe(0); expect(body.credit).toBe(0); expect(original).toBe('小美🧸 e\u0301');
  });

  it('uses a safe fallback for emoji-only names and never alters cashier name or financial fields during nickname updates', async () => {
    process.env.POSPAL_MEMBER_SYNC_ENABLED = 'true';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'success', errorCode: 0, result: {} })));
    await client.updateMemberNickname('123', '🧸');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.updateMask).toEqual(['customerExt.nickName']); expect(body.customerExt.nickName).toBe('月光会员');
    expect(body.name).toBeUndefined(); expect(body.point).toBeUndefined(); expect(body.credit).toBeUndefined();
  });

  it('reports encoding errors without disclosing the upstream SQL, credentials or customer details', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'error', errorCode: -1, messages: ['SQL Incorrect string value: test-key sensitive-member-phone for name'] })));
    const error = await client.checkConnection().catch(failure => failure);
    expect(error.message).toContain('不支持会员资料中的部分特殊字符');
    expect(error.message).not.toMatch(/SQL|test-key|sensitive-member-phone/);
  });

  it('rejects HTTP failure, non-JSON and malformed pagination', async () => {
    fetchMock.mockResolvedValueOnce(new Response('failure', { status: 503 }));
    await expect(client.checkConnection()).rejects.toBeInstanceOf(BadGatewayException);
    fetchMock.mockResolvedValueOnce(new Response('<html>failure</html>'));
    await expect(client.checkConnection()).rejects.toThrow('非 JSON');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', errorCode: 0, result: { list: [] } })));
    await expect(client.checkConnection()).rejects.toThrow('分页');
  });

  it('gates writes and creates a zero-point member with phone uniqueness and no finance payload', async () => {
    await expect(client.createMember('MP123', '13800138000', '昵称')).rejects.toThrow('尚未启用');
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.POSPAL_MEMBER_SYNC_ENABLED = 'true';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', errorCode: 0, result: { uid: '9007199254740993001', number: 'MP123', tel: '13800138000' } })));
    expect(await client.createMember('MP123', '13800138000', '昵称')).toBe('9007199254740993001');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ number: 'MP123', tel: '13800138000', validateTelUnique: true, discount: 100, credit: 0, point: 0 });
    expect(body.money).toBeUndefined(); expect(body.birthday).toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', errorCode: 0, result: {} })));
    await client.updateMemberNickname('101', '新的昵称');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ uid: '101', account: 'test-store', updateMask: ['customerExt.nickName'], customerExt: { nickName: '新的昵称' } });
  });

  it('preserves large UID strings, fetches two candidates and normalizes balances', async () => {
    fetchMock.mockResolvedValue(page([{ uid: '9007199254740993001', number: 'VIP1', name: 'test', money: '12.50', giftMoney: 2, point: '10' }]));
    const result = await client.findMembersByPhone('13800138000');
    expect(result.candidates[0]).toEqual({ uid: '9007199254740993001', number: 'VIP1', name: 'test', balance: 12.5, giftBalance: 2, points: 10 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({ tel: '13800138000', limit: 2 });
  });

  it('refuses lossy IDs and missing balances instead of using zero', async () => {
    fetchMock.mockResolvedValueOnce(page([{ uid: 9007199254740993001, number: 'VIP1', name: 'test', money: 10, giftMoney: 0, point: 10 }]));
    await expect(client.findMembersByPhone('13800138000')).rejects.toThrow('安全精度');
    fetchMock.mockResolvedValueOnce(page([{ uid: '101', number: 'VIP1', name: 'test', giftMoney: 0, point: 10 }]));
    await expect(client.findMembersByPhone('13800138000')).rejects.toThrow('余额或积分格式');
  });

  it('times out without retrying or returning transport error details', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new Error('test-key private transport details')));
    }));
    try {
      const pending = expect(client.checkConnection()).rejects.toThrow('连接失败或超时');
      await jest.advanceTimersByTimeAsync(8001);
      await pending;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('validates the exact UID and membership state for a bound account', async () => {
    const row = { uid: '101', number: 'VIP1', name: 'test', money: '12.50', giftMoney: 2, point: '10', tel: '13800138000', enable: 1 };
    fetchMock.mockResolvedValueOnce(page([row]));
    expect((await client.getMemberByUid('101')).phone).toBe('13800138000');
    fetchMock.mockResolvedValueOnce(page([{ ...row, uid: '102' }]));
    await expect(client.getMemberByUid('101')).rejects.toThrow('不唯一');
    fetchMock.mockResolvedValueOnce(page([{ ...row, isLoss: 1 }]));
    await expect(client.getMemberByUid('101')).rejects.toThrow('挂失');
  });

  it('queries descending history by member UID and exposes refund signs clearly', async () => {
    fetchMock.mockResolvedValueOnce(page([{ id: '1', customerUid: '101', rechargeMoney: 100, giftMoney: 10, datetime: '2026-10-11 12:00:00' }]));
    const recharges = await client.getRecharges('101', 'MI1');
    expect(recharges[0]).toMatchObject({ userId: 'MI1', amount: 100, giftAmount: 10, source: 'POSPAL' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ customerUid: '101', order: 'desc', limit: 100 });
    fetchMock.mockResolvedValueOnce(page([{ uid: '9', customerUid: '101', sn: 'SN1', totalAmount: 30, refund: 1, datetime: '2026-10-11 12:00:00', ticketItems: [{ name: 'test item' }] }]));
    const orders = await client.getConsumptions('101', 'MI1');
    expect(orders[0].finalPrice).toBe(-30);
    expect(orders[0].title).toContain('退货');
    fetchMock.mockResolvedValueOnce(page([{ id: '1', customerUid: 'other-customer' }]));
    await expect(client.getRecharges('101', 'MI1')).rejects.toThrow();
  });

  it('coalesces identical in-flight reads but consecutive explicit refreshes remain live', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const calls = [client.checkConnection(), client.checkConnection()];
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(page([{ userId: '1', company: 'store', self: true }]));
    const results = await Promise.all(calls);
    expect(results[0].requestId).toBe(results[1].requestId);
    fetchMock.mockResolvedValueOnce(page([{ userId: '1', company: 'store', self: true }]));
    await client.checkConnection();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never merges requests for different bound members and retries only after a new caller request', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(page([])));
    await Promise.all([client.getRecharges('101', 'member-a'), client.getRecharges('102', 'member-b')]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRejectedValueOnce(new Error('provider offline'));
    await expect(client.getRecharges('101', 'member-a')).rejects.toBeInstanceOf(BadGatewayException);
    fetchMock.mockResolvedValueOnce(page([]));
    await client.getRecharges('101', 'member-a');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

});
