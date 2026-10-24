export const RECHARGE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type RechargeStatus = (typeof RECHARGE_STATUS)[keyof typeof RECHARGE_STATUS];

export interface WechatLoginRequest {
  code: string;
  openIdHint?: string;
}

export interface LoginResponse {
  loginMethod?: 'wechat' | 'password';
  token: string;
  user: MemberProfile;
}

export interface MemberProfile {
  id: string;
  openId: string;
  phone?: string;
  nickname: string;
  remark?: string;
  avatarUrl: string;
  birthday?: string;
  levelId: string;
  levelName: string;
  discountRate: number;
  balance: number;
  points: number;
  pospal?: { state: 'UNLINKED' | 'LINKED'; customerNumber?: string; syncedAt?: string; memberSync?: { state: string; message?: string } };
}

export interface PospalConfiguration {
  enabled: boolean;
  configured: boolean;
  missingEnv: string[];
  readOnly: boolean;
  memberSyncEnabled?: boolean;
  accountSource: 'local' | 'pospal';
}

export interface PospalConnectionCheck {
  requestId: string;
  checkedAt: string;
  stores: { userId: string; company: string; self: boolean }[];
  hasMore: boolean;
}

export interface PospalMemberCandidate {
  uid: string;
  number: string;
  name: string;
  balance: number;
  giftBalance: number;
  points: number;
}

export interface PospalMemberPreview {
  memberId: string;
  state: 'NO_PHONE' | 'NOT_FOUND' | 'AMBIGUOUS' | 'CANDIDATE';
  local: { balance: number; points: number };
  candidates: PospalMemberCandidate[];
  hasMore: boolean;
  requestId?: string;
  difference?: { balance: number; points: number };
  bindingConfirmed: false;
}

export interface CreateMemberRequest {
  id?: string;
  nickname: string;
  remark?: string;
  phone?: string;
  birthday?: string;
  levelId?: string;
  discountRate?: number;
  balance?: number;
  points?: number;
}

export interface UpdateMemberRequest {
  nickname?: string;
  remark?: string;
  birthday?: string;
  levelId?: string;
  discountRate?: number;
  balance?: number;
  points?: number;
  expectedBalance?: number;
  expectedPoints?: number;
  adjustmentReason?: string;
}

export interface MemberLinkCode {
  code: string;
  expiresAt: string;
}

export interface MemberPhoneRecovery extends MemberLinkCode {
  mode: 'SELF_SERVICE' | 'STORE_REVIEW';
  maskedPhone: string;
}

export interface MemberMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  readAt?: string;
  reply?: string;
  repliedAt?: string;
}

export interface AdminMemberMessage extends MemberMessage {
  memberNickname: string;
  memberPhone?: string;
  memberAvatarUrl: string;
  memberDeleted: boolean;
}

export interface CreateMemberMessageRequest {
  content: string;
  requestId: string;
}

export interface ReplyMemberMessageRequest {
  reply: string;
}

export interface ConfirmMemberLinkRequest {
  code: string;
  verifiedPhone: string;
  identityVerified: true;
}

export interface UpdateMyProfileRequest {
  phone?: string;
  birthday?: string;
  nickname?: string;
}

export interface BindWechatPhoneRequest {
  code: string;
  mockPhone?: string;
}

export interface RechargeApplyRequest {
  amount: number;
  remark?: string;
}

export interface AdminRechargeRequest {
  userId: string;
  amount?: number;
  points?: number;
  remark?: string;
  requestId?: string;
}

export interface PointsLedgerEntry {
  id: string;
  changePoints: number;
  beforePoints: number;
  afterPoints: number;
  reason: string;
  relatedOrderId?: string;
  createdAt: string;
}

export interface RechargeOrder {
  id: string;
  userId: string;
  amount: number;
  status: RechargeStatus;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
  source?: 'POSPAL';
  giftAmount?: number;
}

export interface BalanceLedger {
  id: string;
  userId: string;
  changeAmount: number;
  type: 'RECHARGE_APPROVED' | 'CONSUME_ORDER_CREATED' | 'CONSUME_ORDER_DELETED' | 'MANUAL_ADJUST';
  relatedOrderId?: string;
  createdAt: string;
}

export interface ConsumptionOrder {
  id: string;
  orderNo: string;
  userId: string;
  productType?: string;
  title: string;
  originalPrice: number;
  finalPrice: number;
  discountRate: number;
  effectImages: string[];
  orderDate: string;
  remark?: string;
  createdBy: string;
  createdAt: string;
  source?: 'POSPAL';
}

export interface RevenuePeriodSummary {
  period: string;
  consumptionAmount: number;
  originalAmount: number;
  discountAmount: number;
  orderCount: number;
  rechargeAmount: number;
  rechargeCount: number;
}

export interface RevenueOverview {
  selectedMonth: string;
  monthSummary: RevenuePeriodSummary;
  daily: RevenuePeriodSummary[];
  monthly: RevenuePeriodSummary[];
}

export interface ProductType {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface CreateProductTypeRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateProductTypeRequest {
  name?: string;
  sortOrder?: number;
}

export const BUSINESS_TYPE = {
  NAIL: 'NAIL',
  ACCESSORY: 'ACCESSORY',
  FLOWER: 'FLOWER',
} as const;

export type BusinessType = (typeof BUSINESS_TYPE)[keyof typeof BUSINESS_TYPE];

export interface ProductCategory {
  id: string;
  businessType: BusinessType;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface CatalogProduct {
  id: string;
  businessType: BusinessType;
  categoryId?: string;
  categoryName?: string;
  name: string;
  description?: string;
  referencePrice?: number;
  images: string[];
  sortOrder: number;
  isActive: boolean;
  reservedByUserId?: string;
  reservedAppointmentId?: string;
  reservedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type NailProduct = CatalogProduct & { businessType: typeof BUSINESS_TYPE.NAIL };
export type AccessoryProduct = CatalogProduct & { businessType: typeof BUSINESS_TYPE.ACCESSORY };
export type FlowerProduct = CatalogProduct & { businessType: typeof BUSINESS_TYPE.FLOWER };

export interface CreateProductCategoryRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateProductCategoryRequest {
  name?: string;
  sortOrder?: number;
}

export interface CreateCatalogProductRequest {
  categoryId?: string;
  name: string;
  description?: string;
  referencePrice?: number;
  images?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCatalogProductRequest {
  categoryId?: string | null;
  name?: string;
  description?: string;
  referencePrice?: number | null;
  images?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

export const APPOINTMENT_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

export interface Appointment {
  id: string;
  userId: string;
  memberNickname: string;
  businessType: BusinessType;
  productId?: string;
  productName?: string;
  productImages?: string[];
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  remark?: string;
  adminRemark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookedAppointmentSlot {
  businessType: BusinessType;
  appointmentDate: string;
  startTime: string;
  endTime: string;
}

export type AppointmentAvailabilityScope = BusinessType | 'ALL';

export interface AppointmentUnavailableDate {
  id: string;
  appointmentDate: string;
  businessType: AppointmentAvailabilityScope;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentUnavailableDateRequest {
  appointmentDate: string;
  businessType: AppointmentAvailabilityScope;
  reason?: string;
}

export interface CreateAppointmentRequest {
  businessType?: BusinessType;
  productId?: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  remark?: string;
}

export interface CreateAdminAppointmentRequest extends CreateAppointmentRequest {
  userId: string;
  status?: AppointmentStatus;
  adminRemark?: string;
}

export interface UpdateAppointmentRequest {
  userId?: string;
  businessType?: BusinessType;
  productId?: string | null;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  remark?: string;
  status?: AppointmentStatus;
  adminRemark?: string;
}

export interface CreateConsumptionOrderRequest {
  userId: string;
  productType?: string;
  title: string;
  originalPrice: number;
  discountRate?: number;
  effectImages?: string[];
  orderDate?: string;
  remark?: string;
  requestId?: string;
}

export interface ApproveRechargeRequest {
  adminId?: string;
  comment?: string;
}

export interface RejectRechargeRequest {
  adminId?: string;
  reason: string;
}

export interface MemberLevel {
  id: string;
  name: string;
  minPoints: number;
  discountRate: number;
}

export interface CreateMemberLevelRequest {
  name: string;
  minPoints: number;
  discountRate: number;
}

export interface UpdateMemberLevelRequest {
  name?: string;
  minPoints?: number;
  discountRate?: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: 'ADMIN' | 'MEMBER';
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
