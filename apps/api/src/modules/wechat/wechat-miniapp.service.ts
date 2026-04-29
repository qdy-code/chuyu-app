import { Injectable } from '@nestjs/common';

interface WechatLoginResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WechatPhoneResponse {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber?: string;
    purePhoneNumber?: string;
    countryCode?: string;
  };
}

@Injectable()
export class WechatMiniappService {
  private accessTokenCache: { token: string; expiresAt: number } | null = null;

  async resolveOpenId(code: string, openIdHint?: string): Promise<string> {
    if (this.isMockMode()) {
      return openIdHint?.trim() || process.env.MINIAPP_MOCK_OPEN_ID || 'mock-openid-local-user';
    }

    const appId = this.requiredEnv('WECHAT_MINIAPP_APP_ID');
    const secret = this.requiredEnv('WECHAT_MINIAPP_APP_SECRET');
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', secret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    const data = await this.getJson<WechatLoginResponse>(url.toString());
    if (!data.openid) {
      throw new Error(`wechat login failed: ${data.errmsg || data.errcode || 'missing openid'}`);
    }
    return data.openid;
  }

  async resolvePhoneNumber(code: string, mockPhone?: string): Promise<string> {
    if (this.isMockMode()) {
      const phone = mockPhone || process.env.MINIAPP_MOCK_PHONE;
      if (!phone) {
        throw new Error('MINIAPP_MOCK_PHONE is required in mock mode');
      }
      return phone;
    }

    const accessToken = await this.getAccessToken();
    const data = await this.postJson<WechatPhoneResponse>(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      { code },
    );
    const phone = data.phone_info?.purePhoneNumber || data.phone_info?.phoneNumber;
    if (!phone) {
      throw new Error(`wechat phone failed: ${data.errmsg || data.errcode || 'missing phone number'}`);
    }
    return phone;
  }

  private isMockMode(): boolean {
    return process.env.MINIAPP_LOGIN_MODE === 'mock';
  }

  private requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is required when MINIAPP_LOGIN_MODE is not mock`);
    }
    return value;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now()) {
      return this.accessTokenCache.token;
    }

    const appId = this.requiredEnv('WECHAT_MINIAPP_APP_ID');
    const secret = this.requiredEnv('WECHAT_MINIAPP_APP_SECRET');
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', secret);

    const data = await this.getJson<WechatAccessTokenResponse>(url.toString());
    if (!data.access_token) {
      throw new Error(`wechat access token failed: ${data.errmsg || data.errcode || 'missing access token'}`);
    }

    this.accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max((data.expires_in || 7200) - 300, 60) * 1000,
    };
    return data.access_token;
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`wechat request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private async postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`wechat request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}
