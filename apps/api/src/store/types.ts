import {
  AuditLog,
  BalanceLedger,
  ConsumptionOrder,
  MemberLevel,
  MemberProfile,
  ProductType,
  RechargeOrder,
  RechargeStatus,
  RECHARGE_STATUS,
} from '@member-platform/shared';

export interface AdminUser {
  id: string;
  name: string;
  role: 'SUPER_ADMIN' | 'OPERATOR';
}

export interface DataStore {
  users: MemberProfile[];
  memberLevels: MemberLevel[];
  rechargeOrders: RechargeOrder[];
  consumptionOrders: ConsumptionOrder[];
  productTypes: ProductType[];
  balanceLedgers: BalanceLedger[];
  auditLogs: AuditLog[];
  admins: AdminUser[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function createDefaultStore(): DataStore {
  const levels: MemberLevel[] = [
    { id: 'level-basic', name: '基础会员', minPoints: 0, discountRate: 1 },
    { id: 'level-silver', name: '银卡会员', minPoints: 1000, discountRate: 0.95 },
    { id: 'level-gold', name: '金卡会员', minPoints: 3000, discountRate: 0.9 },
  ];

  const users: MemberProfile[] = [
    {
      id: 'u-demo-001',
      openId: 'wx-openid-demo-001',
      nickname: '演示会员A',
      avatarUrl: 'https://dummyimage.com/120x120/0b0f1a/ffffff.png&text=A',
      birthday: '1998-08-08',
      levelId: 'level-basic',
      levelName: '基础会员',
      discountRate: 1,
      balance: 188,
      points: 320,
    },
  ];

  const rechargeOrders: RechargeOrder[] = [
    {
      id: `R${ymd(new Date())}0001`,
      userId: 'u-demo-001',
      amount: 100,
      status: RECHARGE_STATUS.PENDING,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  const consumptionOrders: ConsumptionOrder[] = [];
  const productTypes: ProductType[] = [
    { id: 'pt-care', name: '护理', sortOrder: 10, createdAt: nowIso() },
    { id: 'pt-therapy', name: '理疗', sortOrder: 20, createdAt: nowIso() },
    { id: 'pt-body', name: '美体', sortOrder: 30, createdAt: nowIso() },
    { id: 'pt-package', name: '套餐', sortOrder: 40, createdAt: nowIso() },
    { id: 'pt-other', name: '其他', sortOrder: 50, createdAt: nowIso() },
  ];
  const balanceLedgers: BalanceLedger[] = [];

  const auditLogs: AuditLog[] = [
    {
      id: 'log-demo-001',
      actorId: 'system',
      actorRole: 'ADMIN',
      action: 'seed.init',
      targetType: 'system',
      targetId: 'bootstrap',
      metadata: { message: 'seed data loaded' },
      createdAt: nowIso(),
    },
  ];

  const admins: AdminUser[] = [{ id: 'admin-001', name: '演示管理员', role: 'SUPER_ADMIN' }];

  return {
    users,
    memberLevels: levels,
    rechargeOrders,
    consumptionOrders,
    productTypes,
    balanceLedgers,
    auditLogs,
    admins,
  };
}

export function isFinalStatus(status: RechargeStatus): boolean {
  return status === RECHARGE_STATUS.APPROVED || status === RECHARGE_STATUS.REJECTED;
}
