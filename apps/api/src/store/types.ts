import {
  AuditLog,
  BalanceLedger,
  BUSINESS_TYPE,
  CatalogProduct,
  ConsumptionOrder,
  MemberLevel,
  MemberProfile,
  ProductCategory,
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
  productCategories: ProductCategory[];
  catalogProducts: CatalogProduct[];
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
      id: 'MI000000000001',
      openId: 'wx-openid-demo-001',
      nickname: '演示会员A',
      avatarUrl: '',
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
      userId: 'MI000000000001',
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
  const productCategories: ProductCategory[] = [
    { id: 'nail-cat-style', businessType: BUSINESS_TYPE.NAIL, name: '款式设计', sortOrder: 10, createdAt: nowIso() },
    { id: 'nail-cat-care', businessType: BUSINESS_TYPE.NAIL, name: '基础护理', sortOrder: 20, createdAt: nowIso() },
    { id: 'accessory-cat-crystal', businessType: BUSINESS_TYPE.ACCESSORY, name: '水晶饰品', sortOrder: 10, createdAt: nowIso() },
    { id: 'accessory-cat-gift', businessType: BUSINESS_TYPE.ACCESSORY, name: '礼物小物', sortOrder: 20, createdAt: nowIso() },
    { id: 'flower-cat-bouquet', businessType: BUSINESS_TYPE.FLOWER, name: '花束', sortOrder: 10, createdAt: nowIso() },
    { id: 'flower-cat-season', businessType: BUSINESS_TYPE.FLOWER, name: '当季鲜花', sortOrder: 20, createdAt: nowIso() },
  ];
  const catalogProducts: CatalogProduct[] = [
    {
      id: 'nail-product-moon-001',
      businessType: BUSINESS_TYPE.NAIL,
      categoryId: 'nail-cat-style',
      categoryName: '款式设计',
      name: '月光石晕染美甲',
      description: '低饱和月光色晕染，适合通勤和轻仪式场景。',
      referencePrice: 168,
      images: [],
      sortOrder: 10,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 'accessory-product-crystal-001',
      businessType: BUSINESS_TYPE.ACCESSORY,
      categoryId: 'accessory-cat-crystal',
      categoryName: '水晶饰品',
      name: '月光水晶手链',
      description: '清透冷光感水晶饰品，到店可试戴预留。',
      referencePrice: 128,
      images: [],
      sortOrder: 10,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 'flower-product-season-001',
      businessType: BUSINESS_TYPE.FLOWER,
      categoryId: 'flower-cat-bouquet',
      categoryName: '花束',
      name: '月白小花束',
      description: '浅色系日常花束，可预约到店取花时间。',
      referencePrice: 99,
      images: [],
      sortOrder: 10,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
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

  const admins: AdminUser[] = [{ id: 'admin-001', name: '门店管理员', role: 'SUPER_ADMIN' }];

  return {
    users,
    memberLevels: levels,
    rechargeOrders,
    consumptionOrders,
    productTypes,
    productCategories,
    catalogProducts,
    balanceLedgers,
    auditLogs,
    admins,
  };
}

export function isFinalStatus(status: RechargeStatus): boolean {
  return status === RECHARGE_STATUS.APPROVED || status === RECHARGE_STATUS.REJECTED;
}
