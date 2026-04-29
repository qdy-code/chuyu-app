export const RECHARGE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type RechargeStatus = (typeof RECHARGE_STATUS)[keyof typeof RECHARGE_STATUS];

export interface WechatLoginRequest {
  code: string;
  openIdHint?: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface LoginResponse {
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
  id?: string;
  nickname?: string;
  remark?: string;
  birthday?: string;
  levelId?: string;
  discountRate?: number;
  balance?: number;
  points?: number;
}

export interface UpdateMyProfileRequest {
  phone?: string;
  birthday?: string;
}

export interface BindWechatPhoneRequest {
  code: string;
  mockPhone?: string;
}

export interface RechargeApplyRequest {
  amount: number;
  remark?: string;
}

export interface RechargeOrder {
  id: string;
  userId: string;
  amount: number;
  status: RechargeStatus;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceLedger {
  id: string;
  userId: string;
  changeAmount: number;
  type: 'RECHARGE_APPROVED' | 'CONSUME_ORDER_CREATED' | 'MANUAL_ADJUST';
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
  appointmentDate: string;
  startTime: string;
  endTime: string;
}

export interface CreateAppointmentRequest {
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
