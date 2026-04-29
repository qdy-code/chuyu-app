import type {
  Appointment,
  BindWechatPhoneRequest,
  BookedAppointmentSlot,
  ConsumptionOrder,
  CreateAppointmentRequest,
  LoginResponse,
  MemberProfile,
  RechargeApplyRequest,
  RechargeOrder,
  UpdateMyProfileRequest,
} from '@member-platform/shared';
import { sessionState } from '@/store/session';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${path}`,
      method: (init?.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE') || 'GET',
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

export async function wechatLoginWithProfile(payload: {
  code: string;
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

export async function bindWechatPhone(
  userId: string,
  payload: BindWechatPhoneRequest,
): Promise<MemberProfile> {
  return request<MemberProfile>('/members/me/phone', {
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

export async function createAppointment(
  userId: string,
  payload: CreateAppointmentRequest,
): Promise<Appointment> {
  return request<Appointment>('/members/me/appointments', {
    method: 'POST',
    headers: { 'x-user-id': userId },
    body: JSON.stringify(payload),
  });
}

export async function listMyAppointments(userId: string): Promise<Appointment[]> {
  return request<Appointment[]>('/members/me/appointments', {
    headers: { 'x-user-id': userId },
  });
}

export async function listBookedAppointmentSlots(
  userId: string,
  date: string,
): Promise<BookedAppointmentSlot[]> {
  return request<BookedAppointmentSlot[]>(`/members/appointments/booked-slots?date=${encodeURIComponent(date)}`, {
    headers: { 'x-user-id': userId },
  });
}

export function toAbsoluteImageUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  return `${API_BASE}${relativeUrl}`;
}
