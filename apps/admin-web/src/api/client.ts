import type {
  AuditLog,
  AdminMemberMessage,
  Appointment,
  AppointmentUnavailableDate,
  BusinessType,
  CatalogProduct,
  ConsumptionOrder,
  CreateAdminAppointmentRequest,
  CreateAppointmentUnavailableDateRequest,
  AdminRechargeRequest,
  CreateCatalogProductRequest,
  CreateMemberRequest,
  CreateConsumptionOrderRequest,
  CreateMemberLevelRequest,
  CreateProductCategoryRequest,
  CreateProductTypeRequest,
  MemberLevel,
  MemberProfile,
  PospalConfiguration,
  PospalConnectionCheck,
  PospalMemberPreview,
  ConfirmMemberLinkRequest,
  ProductCategory,
  ProductType,
  RechargeOrder,
  RevenueOverview,
  RejectRechargeRequest,
  ReplyMemberMessageRequest,
  UpdateAppointmentRequest,
  UpdateCatalogProductRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
  UpdateProductCategoryRequest,
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
    if (response.status === 429) {
      throw new Error('登录尝试过多，请 15 分钟后再试');
    }
    if (response.status >= 500) {
      throw new Error('管理服务暂不可用，请稍后重试');
    }
    throw new Error('密码错误');
  }
  const data = (await response.json()) as { token: string };
  setAdminToken(data.token);
}

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

  if (lower.includes('phone already bound by another member')) return '该手机号已被其他会员使用，请联系门店处理';
  if (lower.includes('member id or phone already exists')) return '会员ID或手机号已存在';
  if (lower.includes('member link code invalid or expired')) return '关联码无效、已使用或已过期，请让顾客重新生成';
  if (lower.includes('member identity verification failed')) return '会员信息不匹配，请核对预留手机号和微信关联状态';
  if (lower.includes('source member has existing data')) return '顾客的新账户已有业务记录或资料，不能直接关联，请先核对';
  if (lower.includes('member assets changed please refresh')) return '会员余额或积分已变化，请刷新页面后重新核对';
  if (lower.includes('asset adjustment reason is required')) return '修改余额或积分需要填写调账原因';
  if (lower.includes('request id already used with different data')) return '本次提交编号已使用，请刷新后重新提交';
  if (lower.includes('member not found')) return '会员不存在';
  if (lower.includes('member has remaining assets')) return '该会员仍有余额或积分，请先处理账户资产';
  if (lower.includes('member has active appointments')) return '该会员仍有待处理或已确认预约，请先处理预约';
  if (lower.includes('member has pending recharge')) return '该会员仍有待处理充值，请先处理充值记录';
  if (lower.includes('product is not available')) return '该产品已下架';
  if (lower.includes('product not found')) return '产品不存在或已下架';
  if (lower.includes('appointment time cannot be in the past')) return '不可选择过往时间';
  if (lower.includes('appointment time slot already booked')) return '该时间已有确认预约';
  if (lower.includes('appointment not found')) return '预约记录不存在或已删除';
  if (lower.includes('appointment date has unavailable settings')) return '该日期已有停约设置，请先恢复后再调整';
  if (lower.includes('invalid appointment date')) return '预约日期格式不正确';
  if (lower.includes('appointment unavailable date cannot be in the past')) return '不可设置过往日期';
  if (lower.includes('appointment unavailable date not found')) return '不可预约日期记录不存在或已删除';
  if (lower.includes('appointment date unavailable')) return '当日预约已满，请选择其他日期';
  if (lower.includes('consumption order not found')) return '消费订单不存在或已删除';
  if (lower.includes('member message not found')) return '留言不存在或已处理';
  if (lower.includes('reply is required')) return '请填写回复内容';
  if (lower.includes('invalid message status')) return '留言筛选条件不正确';
  if (lower.includes('invalid revenue month')) return '统计月份格式不正确';
  if (lower.includes('accessory appointment requires a product')) return '请选择饰品后预约';
  if (lower.includes('birthday can only be changed once')) return '生日日期只能修改一次';
  if (lower.includes('account id can only be changed once')) return '账户ID只能修改一次';
  if (lower.includes('payload too large') || lower.includes('file too large')) return '图片过大，请压缩后重试';
  if (lower.includes('unsupported file') || lower.includes('invalid file')) return '图片格式不支持';
  if (lower.includes('failed to fetch')) return '无法连接 API，请确认后端已启动';
  return message || fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  let response: Response;
  // 注意顺序：必须先把 init 展开，再覆盖 headers，否则 init.headers 会反过来覆盖
  // 我们合并好的（含 Authorization）headers —— 这就是之前 PATCH/POST 必现 401 的根因。
  const { headers: initHeaders, ...restInit } = init || {};
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...restInit,
      headers: {
        ...authHeaders(),
        ...(initHeaders || {}),
      },
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
    // 通过自定义事件通知 UI 重新渲染登录态，避免 window.location.reload() 触发的循环刷新。
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('admin-auth-expired'));
    }
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(readableErrorMessage(text, `请求失败：${response.status}`));
  }
  return response.json() as Promise<T>;
}

export const api = {
  listPospalSync: () => request<{ memberId: string; customerNumber: string; state: string; attempts: number; lastError: string | null }[]>('/admin/pospal/member-sync'),
  retryPospalSync: (id: string) => request<{ queued: boolean }>(`/admin/pospal/member-sync/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
  getPospalStatus: () => request<PospalConfiguration>('/admin/pospal/status'),
  testPospalConnection: () => request<PospalConnectionCheck>('/admin/pospal/connection-test', { method: 'POST' }),
  previewPospalMember: (id: string) => request<PospalMemberPreview>(`/admin/pospal/members/${encodeURIComponent(id)}/preview`, { method: 'POST' }),
  linkPospalMember: (id: string, customerUid: string) => request<{ customerNumber: string }>(`/admin/pospal/members/${encodeURIComponent(id)}/link`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerUid, identityVerified: true }),
  }),
  listMembers: () => request<MemberProfile[]>('/admin/members'),
  createMember: (payload: CreateMemberRequest) =>
    request<MemberProfile>('/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getMember: (id: string) => request<MemberProfile>(`/admin/members/${id}`),
  confirmMemberLink: (id: string, payload: ConfirmMemberLinkRequest) =>
    request<MemberProfile>(`/admin/members/${encodeURIComponent(id)}/wechat-link`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  updateMember: (id: string, payload: UpdateMemberRequest) =>
    request<MemberProfile>(`/admin/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteMember: (id: string) =>
    request<{ success: true }>(`/admin/members/${id}`, {
      method: 'DELETE',
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
  listCatalogCategories: (businessType: BusinessType) =>
    request<ProductCategory[]>(`/admin/catalog/${businessType}/categories`),
  createCatalogCategory: (businessType: BusinessType, payload: CreateProductCategoryRequest) =>
    request<ProductCategory>(`/admin/catalog/${businessType}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateCatalogCategory: (businessType: BusinessType, id: string, payload: UpdateProductCategoryRequest) =>
    request<ProductCategory>(`/admin/catalog/${businessType}/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteCatalogCategory: (businessType: BusinessType, id: string) =>
    request<{ success: true }>(`/admin/catalog/${businessType}/categories/${id}`, {
      method: 'DELETE',
    }),
  listCatalogProducts: (businessType: BusinessType) =>
    request<CatalogProduct[]>(`/admin/catalog/${businessType}/products`),
  createCatalogProduct: (businessType: BusinessType, payload: CreateCatalogProductRequest) =>
    request<CatalogProduct>(`/admin/catalog/${businessType}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateCatalogProduct: (businessType: BusinessType, id: string, payload: UpdateCatalogProductRequest) =>
    request<CatalogProduct>(`/admin/catalog/${businessType}/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteCatalogProduct: (businessType: BusinessType, id: string) =>
    request<{ success: true }>(`/admin/catalog/${businessType}/products/${id}`, {
      method: 'DELETE',
    }),
  listAppointments: () => request<Appointment[]>('/admin/appointments'),
  listAppointmentUnavailableDates: () =>
    request<AppointmentUnavailableDate[]>('/admin/appointment-unavailable-dates'),
  createAppointmentUnavailableDate: (payload: CreateAppointmentUnavailableDateRequest) =>
    request<AppointmentUnavailableDate>('/admin/appointment-unavailable-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteAppointmentUnavailableDate: (id: string) =>
    request<{ success: true }>(`/admin/appointment-unavailable-dates/${id}`, {
      method: 'DELETE',
    }),
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
  deleteAppointment: (id: string) =>
    request<{ success: true }>(`/admin/appointments/${id}`, {
      method: 'DELETE',
    }),
  listRecharges: () => request<RechargeOrder[]>('/admin/recharges'),
  createRecharge: (payload: AdminRechargeRequest) =>
    requestFinancialMutation<MemberProfile>('/admin/recharges', payload),
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
  listMemberMessages: (status: 'unread' | 'all' = 'all') =>
    request<AdminMemberMessage[]>(`/admin/messages?status=${status}`),
  markMemberMessageRead: (id: string) =>
    request<AdminMemberMessage>(`/admin/messages/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  replyMemberMessage: (id: string, payload: ReplyMemberMessageRequest) =>
    request<AdminMemberMessage>(`/admin/messages/${encodeURIComponent(id)}/reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  createConsumptionOrder: (payload: CreateConsumptionOrderRequest) =>
    requestFinancialMutation<ConsumptionOrder>('/admin/orders', payload),
  deleteConsumptionOrder: (id: string) =>
    request<{ success: true }>(`/admin/orders/${id}`, {
      method: 'DELETE',
    }),
  getRevenueOverview: (month: string) =>
    request<RevenueOverview>(`/admin/revenue?month=${encodeURIComponent(month)}`),
  uploadImages: async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    if (files.length > 9) throw new Error('每次最多上传 9 张图片');
    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      throw new Error('单张图片不能超过 8MB');
    }
    const form = new FormData();
    files.forEach((file) => form.append('files', file));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/admin/uploads/images`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('图片上传超时，请压缩后重试');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }

    if (response.status === 401) {
      clearAdminToken();
      window.dispatchEvent(new Event('admin-auth-expired'));
      throw new Error('登录已过期，请重新登录');
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(readableErrorMessage(text, `上传失败：${response.status}`));
    }

    const result = (await response.json()) as { urls: string[] };
    return result.urls;
  },
};

async function requestFinancialMutation<T>(path: string, payload: object): Promise<T> {
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${path}:${canonical}`));
  const key = `admin-pending:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const requestId = localStorage.getItem(key) || crypto.randomUUID();
  localStorage.setItem(key, requestId);
  const result = await request<T>(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId }),
  });
  if (localStorage.getItem(key) === requestId) localStorage.removeItem(key);
  return result;
}

export function toAbsoluteImageUrl(relativeUrl: string): string {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  return `${API_BASE}${relativeUrl}`;
}
