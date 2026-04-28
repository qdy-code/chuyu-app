import {
  AuditLog,
  BalanceLedger,
  ConsumptionOrder,
  MemberLevel,
  MemberProfile,
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
    balanceLedgers,
    auditLogs,
    admins,
  };
}

export function isFinalStatus(status: RechargeStatus): boolean {
  return status === RECHARGE_STATUS.APPROVED || status === RECHARGE_STATUS.REJECTED;
}
