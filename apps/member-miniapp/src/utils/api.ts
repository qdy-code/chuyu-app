import type {
  Appointment,
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://192.168.31.118:3000';

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

export async function getMyProfile(): Promise<MemberProfile> {
  return request<MemberProfile>('/members/me');
}

export async function updateMyProfile(payload: UpdateMyProfileRequest): Promise<MemberProfile> {
  return request<MemberProfile>('/members/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function applyRecharge(payload: RechargeApplyRequest): Promise<RechargeOrder> {
  return request<RechargeOrder>('/recharges/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listMyRecharges(): Promise<RechargeOrder[]> {
  return request<RechargeOrder[]>('/recharges/my');
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

export async function listBookedAppointmentSlots(date: string): Promise<BookedAppointmentSlot[]> {
  return request<BookedAppointmentSlot[]>(`/members/appointments/booked-slots?date=${encodeURIComponent(date)}`);
}

export function toAbsoluteImageUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  return `${API_BASE}${relativeUrl}`;
}
