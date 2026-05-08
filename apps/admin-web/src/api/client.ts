import type {
  AuditLog,
  Appointment,
  ConsumptionOrder,
  CreateAdminAppointmentRequest,
  CreateMemberRequest,
  CreateConsumptionOrderRequest,
  CreateMemberLevelRequest,
  CreateProductTypeRequest,
  MemberLevel,
  MemberProfile,
  ProductType,
  RechargeOrder,
  RejectRechargeRequest,
  UpdateAppointmentRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
  UpdateProductTypeRequest,
} from '@member-platform/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'admin-token';

export function getAdminToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function adminLogin(password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    throw new Error('密码错误');
  }
  const data = (await response.json()) as { token: string };
  setAdminToken(data.token);
}

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        ...authHeaders(),
        ...(init?.headers || {}),
      },
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请检查 API 或数据库是否正常');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 401) {
    clearAdminToken();
    window.location.reload();
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listMembers: () => request<MemberProfile[]>('/admin/members'),
  createMember: (payload: CreateMemberRequest) =>
    request<MemberProfile>('/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getMember: (id: string) => request<MemberProfile>(`/admin/members/${id}`),
  updateMember: (id: string, payload: UpdateMemberRequest) =>
    request<MemberProfile>(`/admin/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  listLevels: () => request<MemberLevel[]>('/admin/member-levels'),
  createLevel: (payload: CreateMemberLevelRequest) =>
    request<MemberLevel>('/admin/member-levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateLevel: (id: string, payload: UpdateMemberLevelRequest) =>
    request<MemberLevel>(`/admin/member-levels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteLevel: (id: string) =>
    request<{ success: true }>(`/admin/member-levels/${id}`, {
      method: 'DELETE',
    }),
  listProductTypes: () => request<ProductType[]>('/admin/product-types'),
  createProductType: (payload: CreateProductTypeRequest) =>
    request<ProductType>('/admin/product-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateProductType: (id: string, payload: UpdateProductTypeRequest) =>
    request<ProductType>(`/admin/product-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteProductType: (id: string) =>
    request<{ success: true }>(`/admin/product-types/${id}`, {
      method: 'DELETE',
    }),
  listAppointments: () => request<Appointment[]>('/admin/appointments'),
  createAppointment: (payload: CreateAdminAppointmentRequest) =>
    request<Appointment>('/admin/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateAppointment: (id: string, payload: UpdateAppointmentRequest) =>
    request<Appointment>(`/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  listRecharges: () => request<RechargeOrder[]>('/admin/recharges'),
  approveRecharge: (id: string) => request<RechargeOrder>(`/admin/recharges/${id}/approve`, { method: 'POST' }),
  rejectRecharge: (id: string, payload: RejectRechargeRequest) =>
    request<RechargeOrder>(`/admin/recharges/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  listAuditLogs: () => request<AuditLog[]>('/admin/audit-logs'),
  listConsumptionOrders: (userId?: string) =>
    request<ConsumptionOrder[]>(userId ? `/admin/orders?userId=${encodeURIComponent(userId)}` : '/admin/orders'),
  listMemberConsumptionOrders: (userId: string) =>
    request<ConsumptionOrder[]>(`/admin/members/${userId}/consumptions`),
  createConsumptionOrder: (payload: CreateConsumptionOrderRequest) =>
    request<ConsumptionOrder>('/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  uploadImages: async (files: File[]): Promise<string[]> => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));

    const response = await fetch(`${API_BASE}/admin/uploads/images`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Upload failed: ${response.status}`);
    }

    const result = (await response.json()) as { urls: string[] };
    return result.urls;
  },
};

export function toAbsoluteImageUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  return `${API_BASE}${relativeUrl}`;
}
