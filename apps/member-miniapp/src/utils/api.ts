import type {
  Appointment,
  AppointmentUnavailableDate,
  BookedAppointmentSlot,
  BusinessType,
  CatalogProduct,
  ConsumptionOrder,
  CreateAppointmentRequest,
  LoginResponse,
  MemberProfile,
  MemberLinkCode,
  MemberMessage,
  PointsLedgerEntry,
  ProductCategory,
  RechargeOrder,
  UpdateMyProfileRequest,
} from '@member-platform/shared';
import { clearSession, sessionState } from '@/store/session';

const CONFIGURED_API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL as string | undefined);
const DEVTOOLS_API_BASE = normalizeApiBase(import.meta.env.VITE_DEVTOOLS_API_BASE_URL as string | undefined);

function normalizeApiBase(value?: string): string {
  return (value || '').trim().replace(/\/$/, '');
}

function resolveApiBase(): string {
  try {
    if (uni.getDeviceInfo().platform === 'devtools' && DEVTOOLS_API_BASE) {
      return DEVTOOLS_API_BASE;
    }
  } catch {
    // 非微信运行环境继续使用配置地址。
  }
  return CONFIGURED_API_BASE;
}

const API_BASE = resolveApiBase();

function pickBackendMessage(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return pickBackendMessage(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map(pickBackendMessage).filter(Boolean).join('；');
  }
  if (typeof value === 'object') {
    const data = value as Record<string, unknown>;
    return (
      pickBackendMessage(data.message) ||
      pickBackendMessage(data.error) ||
      pickBackendMessage(data.reason) ||
      pickBackendMessage(data.errMsg)
    );
  }
  return String(value);
}

export function readableErrorMessage(error: unknown, fallback = '操作失败'): string {
  const raw = error instanceof Error ? error.message : pickBackendMessage(error);
  const message = pickBackendMessage(raw) || fallback;
  const lower = message.toLowerCase();

  if (message.includes('该手机号已被其他会员使用') || lower.includes('phone already bound by another member')) {
    return '该手机号已被其他会员使用，请联系门店处理';
  }
  if (lower.includes('member id or phone already exists')) return '会员ID或手机号已存在';
  if (lower.includes('offline member not found')) return '未找到可关联的门店会员，请联系门店核对';
  if (lower.includes('source member has existing data')) return '当前账户已有资料或业务记录，请由门店核对处理';
  if (lower.includes('member not found')) return '会员登录已失效，请重新登录';
  if (lower.includes('product is not available')) return '该产品已下架';
  if (lower.includes('product not found')) return '产品不存在或已下架';
  if (lower.includes('appointment time cannot be in the past')) return '不可选择过往时间';
  if (lower.includes('appointment time slot already booked')) return '该时间已有确认预约';
  if (lower.includes('appointment date unavailable')) return '当日预约已满，请选择其他日期';
  if (lower.includes('invalid appointment date')) return '预约日期格式不正确';
  if (lower.includes('accessory appointment requires a product')) return '请选择饰品后预约';
  if (lower.includes('birthday can only be changed once')) return '生日日期只能修改一次';
  if (lower.includes('account id can only be changed once')) return '账户ID只能修改一次';
  if (lower.includes('message content is required')) return '请输入留言内容';
  if (lower.includes('request id already used with different data')) return '留言提交编号已使用，请重新输入后提交';
  if (
    lower.includes('invalid code') ||
    lower.includes('code been used') ||
    lower.includes('40029') ||
    lower.includes('40163')
  ) {
    return '微信登录凭证已过期，请重试';
  }
  if (
    lower.includes('invalid appid') ||
    lower.includes('invalid appsecret') ||
    lower.includes('40013') ||
    lower.includes('40125')
  ) {
    return '微信登录配置异常，请联系门店';
  }
  if (
    lower.includes('url not in domain list') ||
    lower.includes('domain list') ||
    lower.includes('不在以下 request 合法域名列表')
  ) {
    return '服务域名未配置，请联系门店';
  }
  if (
    lower.includes('request:fail') ||
    lower.includes('network request failed') ||
    lower.includes('timeout') ||
    lower.includes('bad gateway') ||
    lower.includes('502')
  ) {
    return '网络连接不稳定，请稍后重试';
  }
  if (lower.includes('internal server error') || lower.includes('请求失败：5')) {
    return '服务暂时不可用，请稍后重试';
  }
  return message || fallback;
}

export function isSessionExpiredError(error: unknown): boolean {
  const message = readableErrorMessage(error, '').toLowerCase();
  return (
    message.includes('登录状态已过期') ||
    message.includes('会员登录已失效') ||
    message.includes('请求失败：401')
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!API_BASE) {
      reject(new Error('服务地址未配置，请联系门店'));
      return;
    }
    uni.request({
      url: `${API_BASE}${path}`,
      method: (init?.method as 'GET' | 'POST' | 'PUT' | 'DELETE') || 'GET',
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(sessionState.token ? { Authorization: `Bearer ${sessionState.token}` } : {}),
        ...(init?.headers as Record<string, string>),
      },
      data: init?.body ? JSON.parse(init.body as string) : undefined,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
          return;
        }
        if (res.statusCode === 401) {
          clearSession();
          reject(new Error('登录状态已过期，请重新登录'));
          return;
        }
        reject(new Error(readableErrorMessage(res.data, `请求失败：${res.statusCode}`)));
      },
      fail: (error) => {
        reject(new Error(readableErrorMessage(error.errMsg || 'network request failed')));
      },
    });
  });
}

export async function wechatLoginWithProfile(payload: {
  code: string;
  openIdHint?: string;
}): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyProfile(): Promise<MemberProfile> {
  return request<MemberProfile>('/members/me');
}

export function createMemberLinkCode(phone: string): Promise<MemberLinkCode> {
  return request<MemberLinkCode>('/members/me/link-code', { method: 'POST', body: JSON.stringify({ phone }) });
}

export async function updateMyProfile(payload: UpdateMyProfileRequest): Promise<MemberProfile> {
  return request<MemberProfile>('/members/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listMyMessages(): Promise<MemberMessage[]> {
  return request<MemberMessage[]>('/members/me/messages');
}

export function createMyMessage(content: string, requestId: string): Promise<MemberMessage> {
  return request<MemberMessage>('/members/me/messages', {
    method: 'POST',
    body: JSON.stringify({ content, requestId }),
  });
}

export async function uploadMyAvatar(filePath: string): Promise<MemberProfile> {
  return new Promise<MemberProfile>((resolve, reject) => {
    if (!API_BASE) {
      reject(new Error('服务地址未配置，请联系门店'));
      return;
    }
    uni.uploadFile({
      url: `${API_BASE}/members/me/avatar`,
      filePath,
      name: 'file',
      header: {
        ...(sessionState.token ? { Authorization: `Bearer ${sessionState.token}` } : {}),
      },
      success: (response) => {
        let data: unknown = response.data;
        try {
          data = JSON.parse(response.data);
        } catch {
          // 错误解析会继续使用原始响应文本。
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data as MemberProfile);
          return;
        }
        reject(new Error(readableErrorMessage(data, `上传失败：${response.statusCode}`)));
      },
      fail: (error) => {
        reject(new Error(readableErrorMessage(error.errMsg || 'network request failed')));
      },
    });
  });
}

export async function listCatalogCategories(businessType: BusinessType): Promise<ProductCategory[]> {
  return request<ProductCategory[]>(`/members/catalog/${businessType}/categories`);
}

export async function listCatalogProducts(
  businessType: BusinessType,
  categoryId?: string,
): Promise<CatalogProduct[]> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  return request<CatalogProduct[]>(`/members/catalog/${businessType}/products${query}`);
}

export async function listMyRecharges(): Promise<RechargeOrder[]> {
  return request<RechargeOrder[]>('/recharges/my');
}

export function listMyPointsLedger(): Promise<PointsLedgerEntry[]> {
  return request<PointsLedgerEntry[]>('/members/me/points-ledger');
}

export async function listMyConsumptions(): Promise<ConsumptionOrder[]> {
  return request<ConsumptionOrder[]>('/consumptions/my');
}

export async function createAppointment(payload: CreateAppointmentRequest): Promise<Appointment> {
  return request<Appointment>('/members/me/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listMyAppointments(): Promise<Appointment[]> {
  return request<Appointment[]>('/members/me/appointments');
}

export async function listBookedAppointmentSlots(
  date: string,
  businessType: BusinessType = 'NAIL',
): Promise<BookedAppointmentSlot[]> {
  return request<BookedAppointmentSlot[]>(
    `/members/appointments/booked-slots?date=${encodeURIComponent(date)}&businessType=${encodeURIComponent(businessType)}`,
  );
}

export async function listAppointmentUnavailableDates(
  businessType: BusinessType,
  from?: string,
  to?: string,
): Promise<AppointmentUnavailableDate[]> {
  const query = [`businessType=${encodeURIComponent(businessType)}`];
  if (from) query.push(`from=${encodeURIComponent(from)}`);
  if (to) query.push(`to=${encodeURIComponent(to)}`);
  return request<AppointmentUnavailableDate[]>(`/members/appointments/unavailable-dates?${query.join('&')}`);
}

export function toAbsoluteImageUrl(relativeUrl: string): string {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  if (relativeUrl.startsWith('/static/')) {
    return relativeUrl;
  }
  return API_BASE ? `${API_BASE}${relativeUrl}` : relativeUrl;
}
