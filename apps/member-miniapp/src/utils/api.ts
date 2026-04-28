import type {
  ConsumptionOrder,
  LoginResponse,
  MemberProfile,
  RechargeApplyRequest,
  RechargeOrder,
  UpdateMyProfileRequest,
} from '@member-platform/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${path}`,
      method: (init?.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE') || 'GET',
      header: {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string>),
      },
      data: init?.body ? JSON.parse(init.body as string) : undefined,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
          return;
        }
        const message =
          typeof res.data === 'string'
            ? res.data
            : JSON.stringify(res.data || { statusCode: res.statusCode });
        reject(new Error(message));
      },
      fail: (error) => {
        reject(new Error(error.errMsg || 'network request failed'));
      },
    });
  });
}

export async function wechatLogin(code: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function wechatLoginWithProfile(payload: {
  code: string;
  openIdHint?: string;
  nickname?: string;
  avatarUrl?: string;
}): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyProfile(userId: string): Promise<MemberProfile> {
  return request<MemberProfile>('/members/me', {
    headers: { 'x-user-id': userId },
  });
}

export async function updateMyProfile(userId: string, payload: UpdateMyProfileRequest): Promise<MemberProfile> {
  return request<MemberProfile>('/members/me', {
    method: 'PATCH',
    headers: { 'x-user-id': userId },
    body: JSON.stringify(payload),
  });
}

export async function applyRecharge(userId: string, payload: RechargeApplyRequest): Promise<RechargeOrder> {
  return request<RechargeOrder>('/recharges/apply', {
    method: 'POST',
    headers: { 'x-user-id': userId },
    body: JSON.stringify(payload),
  });
}

export async function listMyRecharges(userId: string): Promise<RechargeOrder[]> {
  return request<RechargeOrder[]>('/recharges/my', {
    headers: { 'x-user-id': userId },
  });
}

export async function listMyConsumptions(userId: string): Promise<ConsumptionOrder[]> {
  return request<ConsumptionOrder[]>('/consumptions/my', {
    headers: { 'x-user-id': userId },
  });
}

export function toAbsoluteImageUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  return `${API_BASE}${relativeUrl}`;
}
