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
  avatarUrl: string;
  birthday?: string;
  levelId: string;
  levelName: string;
  discountRate: number;
  balance: number;
  points: number;
}

export interface UpdateMemberRequest {
  id?: string;
  nickname?: string;
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
