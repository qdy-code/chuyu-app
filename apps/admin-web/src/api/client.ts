import type {
  AuditLog,
  ConsumptionOrder,
  CreateConsumptionOrderRequest,
  CreateMemberLevelRequest,
  MemberLevel,
  MemberProfile,
  RechargeOrder,
  RejectRechargeRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
} from '@member-platform/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'x-admin-id': 'admin-001',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listMembers: () => request<MemberProfile[]>('/admin/members'),
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
      headers: {
        'x-admin-id': 'admin-001',
      },
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
