import { WechatMiniappService } from './wechat-miniapp.service';

describe('WechatMiniappService phone authorization', () => {
  const previousEnv = { ...process.env };
  let service: WechatMiniappService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.MINIAPP_LOGIN_MODE = 'real';
    process.env.WECHAT_MINIAPP_APP_ID = 'test-app';
    process.env.WECHAT_MINIAPP_APP_SECRET = 'test-secret';
    service = new WechatMiniappService();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    process.env = { ...previousEnv };
    jest.restoreAllMocks();
  });

  function response(data: unknown) {
    return new Response(JSON.stringify(data));
  }

  it('uses the authorized phone code and ignores a caller-supplied mock phone in real mode', async () => {
    fetchMock.mockResolvedValueOnce(response({ access_token: 'test-token', expires_in: 7200 }));
    fetchMock.mockResolvedValueOnce(response({ errcode: 0, phone_info: { purePhoneNumber: '13800138000' } }));
    expect(await service.resolvePhoneNumber('one-use-phone-code', '13900139000')).toBe('13800138000');
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=test-token');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ code: 'one-use-phone-code' });
  });

  it('reuses the access token but exchanges every fresh phone code only once', async () => {
    fetchMock.mockResolvedValueOnce(response({ access_token: 'test-token', expires_in: 7200 }));
    fetchMock.mockImplementation(async () => response({ errcode: 0, phone_info: { purePhoneNumber: '13800138000' } }));
    await service.resolvePhoneNumber('first-code');
    await service.resolvePhoneNumber('second-code');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const codes = fetchMock.mock.calls.slice(1).map((call) => JSON.parse(call[1].body).code);
    expect(codes).toEqual(['first-code', 'second-code']);
  });

  it('rejects an expired authorization without retrying or falling back to the supplied phone', async () => {
    fetchMock.mockResolvedValueOnce(response({ access_token: 'test-token', expires_in: 7200 }));
    fetchMock.mockResolvedValueOnce(response({ errcode: 40029, errmsg: 'invalid code' }));
    await expect(service.resolvePhoneNumber('expired-code', '13900139000')).rejects.toThrow('wechat phone failed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not exchange the phone code when platform credentials or the server IP are rejected', async () => {
    fetchMock.mockResolvedValueOnce(response({ errcode: 40164, errmsg: 'invalid ip' }));
    await expect(service.resolvePhoneNumber('phone-code')).rejects.toThrow('wechat access token failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
