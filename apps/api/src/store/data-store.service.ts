import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  AuditLog,
  APPOINTMENT_STATUS,
  Appointment,
  AdminRechargeRequest,
  AppointmentAvailabilityScope,
  AppointmentStatus,
  AppointmentUnavailableDate,
  BalanceLedger,
  BookedAppointmentSlot,
  BUSINESS_TYPE,
  BusinessType,
  CatalogProduct,
  CreateAdminAppointmentRequest,
  CreateAppointmentUnavailableDateRequest,
  ConsumptionOrder,
  CreateAppointmentRequest,
  CreateCatalogProductRequest,
  CreateConsumptionOrderRequest,
  CreateMemberRequest,
  CreateMemberLevelRequest,
  CreateProductCategoryRequest,
  CreateProductTypeRequest,
  MemberLevel,
  MemberProfile,
  ProductCategory,
  ProductType,
  RechargeApplyRequest,
  RechargeOrder,
  RevenueOverview,
  RechargeStatus,
  RECHARGE_STATUS,
  RejectRechargeRequest,
  UpdateCatalogProductRequest,
  UpdateMyProfileRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
  UpdateAppointmentRequest,
  UpdateProductCategoryRequest,
  UpdateProductTypeRequest,
  WechatLoginRequest,
} from '@member-platform/shared';
import { AdminUser, createDefaultStore, DataStore, isFinalStatus } from './types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from './prisma.service';
import { buildRevenueOverview } from './revenue-summary';

type DbMember = {
  id: string;
  openId: string;
  phone: string | null;
  nickname: string;
  remark: string | null;
  avatarUrl: string;
  birthday: string | null;
  levelId: string;
  levelName: string;
  discountRate: number;
  balance: number;
  points: number;
  accountIdChangedAt: Date | null;
};

type DbMemberLevel = {
  id: string;
  name: string;
  minPoints: number;
  discountRate: number;
};

type DbRechargeOrder = {
  id: string;
  userId: string;
  amount: number;
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DbConsumptionOrder = {
  id: string;
  orderNo: string;
  userId: string;
  productType: string | null;
  title: string;
  originalPrice: number;
  finalPrice: number;
  discountRate: number;
  effectImages: string[];
  orderDate: string;
  remark: string | null;
  createdBy: string;
  createdAt: Date;
};

type DbProductType = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
};

type DbProductCategory = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
};

type DbCatalogProduct = {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  description: string | null;
  referencePrice: number | null;
  images: string[];
  sortOrder: number;
  isActive: boolean;
  reservedByUserId?: string | null;
  reservedAppointmentId?: string | null;
  reservedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DbAppointment = {
  id: string;
  userId: string;
  memberNickname: string;
  businessType: string;
  productId: string | null;
  productName: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  remark: string | null;
  adminRemark: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DbBalanceLedger = {
  id: string;
  userId: string;
  changeAmount: number;
  type: string;
  relatedOrderId: string | null;
  createdAt: Date;
};

type DbAuditLog = {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: Date;
};

type DbAdminUser = {
  id: string;
  name: string;
  role: string;
};

@Injectable()
export class DataStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async resetWithSeed(): Promise<DataStore> {
    const seed = createDefaultStore();

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany();
      await tx.balanceLedger.deleteMany();
      await tx.consumptionOrder.deleteMany();
      await tx.appointmentUnavailableDate.deleteMany();
      await tx.appointment.deleteMany();
      await tx.nailProduct.deleteMany();
      await tx.accessoryProduct.deleteMany();
      await tx.flowerProduct.deleteMany();
      await tx.nailCategory.deleteMany();
      await tx.accessoryCategory.deleteMany();
      await tx.flowerCategory.deleteMany();
      await tx.productType.deleteMany();
      await tx.rechargeOrder.deleteMany();
      await tx.member.deleteMany();
      await tx.memberLevel.deleteMany();
      await tx.adminUser.deleteMany();

      await tx.memberLevel.createMany({ data: seed.memberLevels });
      await tx.member.createMany({ data: seed.users.map((user) => this.memberToDb(user)) });
      await tx.rechargeOrder.createMany({
        data: seed.rechargeOrders.map((order) => this.rechargeToDb(order)),
      });
      await tx.consumptionOrder.createMany({
        data: seed.consumptionOrders.map((order) => this.consumptionToDb(order)),
      });
      await tx.productType.createMany({
        data: seed.productTypes.map((item) => this.productTypeToDb(item)),
      });
      await tx.nailCategory.createMany({
        data: seed.productCategories
          .filter((item) => item.businessType === BUSINESS_TYPE.NAIL)
          .map((item) => this.productCategoryToDb(item)),
      });
      await tx.accessoryCategory.createMany({
        data: seed.productCategories
          .filter((item) => item.businessType === BUSINESS_TYPE.ACCESSORY)
          .map((item) => this.productCategoryToDb(item)),
      });
      await tx.flowerCategory.createMany({
        data: seed.productCategories
          .filter((item) => item.businessType === BUSINESS_TYPE.FLOWER)
          .map((item) => this.productCategoryToDb(item)),
      });
      await tx.nailProduct.createMany({
        data: seed.catalogProducts
          .filter((item) => item.businessType === BUSINESS_TYPE.NAIL)
          .map((item) => this.catalogProductToDb(item)),
      });
      await tx.accessoryProduct.createMany({
        data: seed.catalogProducts
          .filter((item) => item.businessType === BUSINESS_TYPE.ACCESSORY)
          .map((item) => this.catalogProductToDb(item)),
      });
      await tx.flowerProduct.createMany({
        data: seed.catalogProducts
          .filter((item) => item.businessType === BUSINESS_TYPE.FLOWER)
          .map((item) => this.catalogProductToDb(item)),
      });
      await tx.balanceLedger.createMany({
        data: seed.balanceLedgers.map((ledger) => this.ledgerToDb(ledger)),
      });
      await tx.auditLog.createMany({
        data: seed.auditLogs.map((log) => this.auditToDb(log)),
      });
      await tx.adminUser.createMany({ data: seed.admins });
    });

    return seed;
  }

  async getAdmins(): Promise<AdminUser[]> {
    await this.ensureBootstrapData();
    const admins = await this.prisma.adminUser.findMany({ orderBy: { id: 'asc' } });
    return admins.map((admin) => this.toAdminUser(admin));
  }

  async getMemberById(id: string): Promise<MemberProfile | undefined> {
    const member = await this.prisma.member.findUnique({ where: { id } });
    return member ? this.toMemberProfile(member) : undefined;
  }

  async getMemberByOpenId(openId: string): Promise<MemberProfile | undefined> {
    const member = await this.prisma.member.findUnique({ where: { openId } });
    return member ? this.toMemberProfile(member) : undefined;
  }

  async listMembers(): Promise<MemberProfile[]> {
    const members = await this.prisma.member.findMany({ orderBy: { id: 'asc' } });
    return members.map((member) => this.toMemberProfile(member));
  }

  async createMember(payload: CreateMemberRequest): Promise<{ member?: MemberProfile; reason?: string }> {
    await this.ensureBootstrapData();

    const memberId = payload.id?.trim() || (await this.generateMemberNumber());
    const nickname = payload.nickname.trim();
    if (!nickname) {
      return { reason: 'nickname is required' };
    }
    if (payload.birthday && !this.isValidBirthdayMonthDay(payload.birthday)) {
      return { reason: 'birthday must use valid MM-DD format' };
    }

    const duplicated = await this.prisma.member.findFirst({
      where: {
        OR: [{ id: memberId }, { openId: `admin-created-${memberId}` }, ...(payload.phone ? [{ phone: payload.phone }] : [])],
      },
    });
    if (duplicated) {
      return { reason: 'member id or phone already exists' };
    }

    const level = payload.levelId
      ? await this.prisma.memberLevel.findUnique({ where: { id: payload.levelId } })
      : await this.prisma.memberLevel.findFirst({ orderBy: { minPoints: 'asc' } });
    if (!level) {
      return { reason: 'level not found' };
    }

    const member = await this.prisma.member.create({
      data: {
        id: memberId,
        openId: `admin-created-${memberId}`,
        phone: payload.phone?.trim() || null,
        nickname,
        remark: payload.remark?.trim() || null,
        avatarUrl: '',
        birthday: payload.birthday || null,
        levelId: level.id,
        levelName: level.name,
        discountRate: payload.discountRate ?? level.discountRate,
        balance: this.round2(payload.balance ?? 0),
        points: this.round2(payload.points ?? 0),
      },
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'member.create',
      targetType: 'member',
      targetId: member.id,
      metadata: {
        nickname: member.nickname,
        remark: member.remark,
        levelId: member.levelId,
        balance: member.balance,
        points: member.points,
      },
    });

    return { member: this.toMemberProfile(member) };
  }

  async loginByWechat(payload: WechatLoginRequest): Promise<MemberProfile> {
    await this.ensureBootstrapData();

    const openId = payload.openIdHint?.trim() || `wx-${payload.code}`;
    const found = await this.prisma.member.findUnique({ where: { openId } });
    if (found) {
      return this.toMemberProfile(found);
    }

    const level = await this.prisma.memberLevel.findFirst({ orderBy: { minPoints: 'asc' } });
    if (!level) {
      throw new Error('member level seed data is missing');
    }

    const memberId = await this.generateMemberNumber();
    const user = await this.prisma.member.create({
      data: {
        id: memberId,
        openId,
        phone: null,
        nickname: '微信用户',
        remark: null,
        avatarUrl: '',
        birthday: null,
        levelId: level.id,
        levelName: level.name,
        discountRate: level.discountRate,
        balance: 0,
        points: 0,
      },
    });

    await this.writeAudit({
      actorId: user.id,
      actorRole: 'MEMBER',
      action: 'auth.wechat.login',
      targetType: 'user',
      targetId: user.id,
      metadata: { openId },
    });

    return this.toMemberProfile(user);
  }

  async listRechargeOrders(userId?: string): Promise<RechargeOrder[]> {
    const orders = await this.prisma.rechargeOrder.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.toRechargeOrder(order));
  }

  async getRechargeById(orderId: string): Promise<RechargeOrder | undefined> {
    const order = await this.prisma.rechargeOrder.findUnique({ where: { id: orderId } });
    return order ? this.toRechargeOrder(order) : undefined;
  }

  async applyRecharge(userId: string, payload: RechargeApplyRequest): Promise<RechargeOrder> {
    const existing = await this.prisma.rechargeOrder.findMany({
      select: { id: true },
      where: { id: { startsWith: `R${this.compactDate(new Date().toISOString().slice(0, 10))}` } },
    });
    const nextRechargeId = this.createDailyCode(
      'R',
      new Date().toISOString().slice(0, 10),
      existing.map((item) => item.id),
    );

    const order = await this.prisma.rechargeOrder.create({
      data: {
        id: nextRechargeId,
        userId,
        amount: payload.amount,
        status: RECHARGE_STATUS.PENDING,
        rejectReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.writeAudit({
      actorId: userId,
      actorRole: 'MEMBER',
      action: 'recharge.apply',
      targetType: 'recharge_order',
      targetId: order.id,
      metadata: payload.remark ? { remark: payload.remark } : undefined,
    });

    return this.toRechargeOrder(order);
  }

  async createAdminRecharge(
    adminId: string,
    payload: AdminRechargeRequest,
  ): Promise<{ member?: MemberProfile; order?: RechargeOrder; reason?: string }> {
    const amount = this.round2(payload.amount ?? 0);
    const points = this.round2(payload.points ?? 0);
    if (amount <= 0 && points <= 0) {
      return { reason: 'amount or points must be greater than 0' };
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.member.findUnique({ where: { id: payload.userId } });
      if (!user) {
        return { reason: 'member not found' };
      }

      const beforeBalance = user.balance;
      const beforePoints = user.points;
      const nextBalance = this.round2(user.balance + amount);
      const nextPoints = this.round2(user.points + points);
      const matchedLevel = await this.getMatchedLevel(nextPoints, tx);

      let rechargeOrder: DbRechargeOrder | undefined;
      if (amount > 0) {
        const today = this.localDateString();
        const existing = await tx.rechargeOrder.findMany({
          select: { id: true },
          where: { id: { startsWith: `R${this.compactDate(today)}` } },
        });
        const nextRechargeId = this.createDailyCode(
          'R',
          today,
          existing.map((item) => item.id),
        );

        rechargeOrder = await tx.rechargeOrder.create({
          data: {
            id: nextRechargeId,
            userId: user.id,
            amount,
            status: RECHARGE_STATUS.APPROVED,
            rejectReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.balanceLedger.create({
          data: {
            id: `bl-${uuid()}`,
            userId: user.id,
            changeAmount: amount,
            type: 'RECHARGE_APPROVED',
            relatedOrderId: rechargeOrder.id,
            createdAt: new Date(),
          },
        });
      }

      const updated = await tx.member.update({
        where: { id: user.id },
        data: {
          balance: nextBalance,
          points: nextPoints,
          ...(matchedLevel
            ? {
                levelId: matchedLevel.id,
                levelName: matchedLevel.name,
                discountRate: matchedLevel.discountRate,
              }
            : {}),
        },
      });

      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'member.recharge',
          targetType: 'member',
          targetId: user.id,
          metadata: {
            ...(payload.remark?.trim() ? { remark: payload.remark.trim() } : {}),
            rechargeOrderId: rechargeOrder?.id,
            balance: { from: beforeBalance, to: nextBalance, change: amount },
            points: { from: beforePoints, to: nextPoints, change: points },
          },
        },
        tx,
      );

      return {
        member: this.toMemberProfile(updated),
        order: rechargeOrder ? this.toRechargeOrder(rechargeOrder) : undefined,
      };
    });
  }

  async approveRecharge(
    orderId: string,
    adminId: string,
    comment?: string,
  ): Promise<RechargeOrder | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.rechargeOrder.findUnique({ where: { id: orderId } });
      if (!order || isFinalStatus(order.status as RechargeStatus)) {
        return undefined;
      }

      const user = await tx.member.findUnique({ where: { id: order.userId } });
      if (!user) {
        return undefined;
      }

      const beforeBalance = user.balance;
      const beforePoints = user.points;
      const nextBalance = this.round2(user.balance + order.amount);
      const nextPoints = this.round2(user.points + Math.floor(order.amount));
      const matchedLevel = await this.getMatchedLevel(nextPoints, tx);

      const updatedOrder = await tx.rechargeOrder.update({
        where: { id: order.id },
        data: {
          status: RECHARGE_STATUS.APPROVED,
          updatedAt: new Date(),
        },
      });

      await tx.member.update({
        where: { id: user.id },
        data: {
          balance: nextBalance,
          points: nextPoints,
          ...(matchedLevel
            ? {
                levelId: matchedLevel.id,
                levelName: matchedLevel.name,
                discountRate: matchedLevel.discountRate,
              }
            : {}),
        },
      });

      await tx.balanceLedger.create({
        data: {
          id: `bl-${uuid()}`,
          userId: user.id,
          changeAmount: order.amount,
          type: 'RECHARGE_APPROVED',
          relatedOrderId: order.id,
          createdAt: new Date(),
        },
      });

      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'recharge.approve',
          targetType: 'recharge_order',
          targetId: order.id,
          metadata: {
            ...(comment ? { comment } : {}),
            userId: user.id,
            balance: { from: beforeBalance, to: nextBalance },
            points: { from: beforePoints, to: nextPoints },
          },
        },
        tx,
      );

      return this.toRechargeOrder(updatedOrder);
    });
  }

  async rejectRecharge(
    orderId: string,
    adminId: string,
    payload: RejectRechargeRequest,
  ): Promise<RechargeOrder | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.rechargeOrder.findUnique({ where: { id: orderId } });
      if (!order || isFinalStatus(order.status as RechargeStatus)) {
        return undefined;
      }

      const updatedOrder = await tx.rechargeOrder.update({
        where: { id: order.id },
        data: {
          status: RECHARGE_STATUS.REJECTED,
          rejectReason: payload.reason,
          updatedAt: new Date(),
        },
      });

      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'recharge.reject',
          targetType: 'recharge_order',
          targetId: order.id,
          metadata: { reason: payload.reason },
        },
        tx,
      );

      return this.toRechargeOrder(updatedOrder);
    });
  }

  async listConsumptionOrders(userId?: string): Promise<ConsumptionOrder[]> {
    const orders = await this.prisma.consumptionOrder.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.toConsumptionOrder(order));
  }

  async deleteConsumptionOrder(
    orderId: string,
    adminId: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.consumptionOrder.findUnique({ where: { id: orderId } });
      if (!order) {
        return { success: false, reason: 'consumption order not found' };
      }

      const member = await tx.member.findUnique({ where: { id: order.userId } });
      if (!member) {
        return { success: false, reason: 'member not found' };
      }

      const nextBalance = this.round2(member.balance + order.finalPrice);
      await tx.member.update({
        where: { id: member.id },
        data: { balance: nextBalance },
      });
      await tx.consumptionOrder.delete({ where: { id: order.id } });
      await tx.balanceLedger.create({
        data: {
          id: `bl-${uuid()}`,
          userId: member.id,
          changeAmount: order.finalPrice,
          type: 'CONSUME_ORDER_DELETED',
          relatedOrderId: order.id,
          createdAt: new Date(),
        },
      });
      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'consumption.delete',
          targetType: 'consumption_order',
          targetId: order.id,
          metadata: {
            orderNo: order.orderNo,
            userId: order.userId,
            title: order.title,
            orderDate: order.orderDate,
            finalPrice: order.finalPrice,
            balance: { from: member.balance, to: nextBalance, change: order.finalPrice },
          },
        },
        tx,
      );

      return { success: true };
    });
  }

  async getRevenueOverview(selectedMonth = this.chinaDateString(new Date()).slice(0, 7)): Promise<RevenueOverview> {
    const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(selectedMonth);
    if (!match) {
      throw new Error('invalid revenue month');
    }

    const year = Number(match[1]);
    const yearText = String(year);
    const yearStart = new Date(`${yearText}-01-01T00:00:00+08:00`);
    const nextYearStart = new Date(`${year + 1}-01-01T00:00:00+08:00`);

    const [orders, recharges] = await Promise.all([
      this.prisma.consumptionOrder.findMany({
        where: { orderDate: { startsWith: `${yearText}-` } },
        select: { orderDate: true, originalPrice: true, finalPrice: true },
      }),
      this.prisma.rechargeOrder.findMany({
        where: {
          status: RECHARGE_STATUS.APPROVED,
          createdAt: { gte: yearStart, lt: nextYearStart },
        },
        select: { amount: true, createdAt: true },
      }),
    ]);

    return buildRevenueOverview(
      selectedMonth,
      orders,
      recharges.map((recharge) => ({
        date: this.chinaDateString(recharge.createdAt),
        amount: recharge.amount,
      })),
    );
  }

  async createConsumptionOrder(
    adminId: string,
    payload: CreateConsumptionOrderRequest,
  ): Promise<{ order?: ConsumptionOrder; reason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.member.findUnique({ where: { id: payload.userId } });
      if (!user) {
        return { reason: 'member not found' };
      }

      const discountRate =
        payload.discountRate ?? user.discountRate ?? (await this.getDiscountRateByLevel(user.levelId, tx)) ?? 1;
      const finalPrice = this.round2(payload.originalPrice * discountRate);

      if (user.balance < finalPrice) {
        return { reason: 'insufficient balance' };
      }

      const orderDate = payload.orderDate || new Date().toISOString().slice(0, 10);
      const existing = await tx.consumptionOrder.findMany({
        select: { orderNo: true },
        where: { orderNo: { startsWith: `CO${this.compactDate(orderDate)}` } },
      });
      const beforeBalance = user.balance;
      const nextBalance = this.round2(user.balance - finalPrice);

      const order = await tx.consumptionOrder.create({
        data: {
          id: `c-${uuid()}`,
          orderNo: this.createDailyCode(
            'CO',
            orderDate,
            existing.map((item) => item.orderNo),
          ),
          userId: payload.userId,
          productType: payload.productType || null,
          title: payload.title,
          originalPrice: this.round2(payload.originalPrice),
          finalPrice,
          discountRate,
          effectImages: payload.effectImages || [],
          orderDate,
          remark: payload.remark || null,
          createdBy: adminId,
          createdAt: new Date(),
        },
      });

      await tx.member.update({
        where: { id: user.id },
        data: { balance: nextBalance },
      });

      await tx.balanceLedger.create({
        data: {
          id: `bl-${uuid()}`,
          userId: user.id,
          changeAmount: -order.finalPrice,
          type: 'CONSUME_ORDER_CREATED',
          relatedOrderId: order.id,
          createdAt: new Date(),
        },
      });

      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'consumption.create',
          targetType: 'consumption_order',
          targetId: order.id,
          metadata: {
            userId: payload.userId,
            originalPrice: payload.originalPrice,
            discountRate,
            finalPrice,
            productType: payload.productType,
            balance: { from: beforeBalance, to: nextBalance },
          },
        },
        tx,
      );

      return { order: this.toConsumptionOrder(order) };
    });
  }

  async listProductTypes(): Promise<ProductType[]> {
    await this.ensureBootstrapData();
    const items = await this.prisma.productType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return items.map((item) => this.toProductType(item));
  }

  async createProductType(payload: CreateProductTypeRequest): Promise<{ productType?: ProductType; reason?: string }> {
    const name = payload.name.trim();
    if (!name) {
      return { reason: 'product type name is required' };
    }

    const duplicated = await this.prisma.productType.findUnique({ where: { name } });
    if (duplicated) {
      return { reason: 'product type already exists' };
    }

    const productType = await this.prisma.productType.create({
      data: {
        id: `pt-${uuid()}`,
        name,
        sortOrder: payload.sortOrder ?? 100,
        createdAt: new Date(),
      },
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'product_type.create',
      targetType: 'product_type',
      targetId: productType.id,
      metadata: { name: productType.name },
    });

    return { productType: this.toProductType(productType) };
  }

  async updateProductType(
    id: string,
    payload: UpdateProductTypeRequest,
  ): Promise<{ productType?: ProductType; reason?: string }> {
    const existing = await this.prisma.productType.findUnique({ where: { id } });
    if (!existing) {
      return { reason: 'product type not found' };
    }

    const nextName = payload.name?.trim();
    if (payload.name !== undefined && !nextName) {
      return { reason: 'product type name is required' };
    }
    if (nextName) {
      const duplicated = await this.prisma.productType.findUnique({ where: { name: nextName } });
      if (duplicated && duplicated.id !== id) {
        return { reason: 'product type already exists' };
      }
    }

    const updated = await this.prisma.productType.update({
      where: { id },
      data: {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
      },
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'product_type.update',
      targetType: 'product_type',
      targetId: updated.id,
      metadata: { changes: this.diffSnapshot({ name: existing.name, sortOrder: existing.sortOrder }, { name: updated.name, sortOrder: updated.sortOrder }) },
    });

    return { productType: this.toProductType(updated) };
  }

  async deleteProductType(id: string): Promise<{ success: boolean; reason?: string }> {
    const existing = await this.prisma.productType.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, reason: 'product type not found' };
    }

    await this.prisma.productType.delete({ where: { id } });
    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'product_type.delete',
      targetType: 'product_type',
      targetId: id,
      metadata: { name: existing.name },
    });

    return { success: true };
  }

  async listProductCategories(businessType: BusinessType): Promise<ProductCategory[]> {
    await this.ensureBootstrapData();
    const delegate = this.categoryDelegate(businessType);
    const items = await delegate.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return items.map((item: DbProductCategory) => this.toProductCategory(businessType, item));
  }

  async createProductCategory(
    businessType: BusinessType,
    payload: CreateProductCategoryRequest,
  ): Promise<{ category?: ProductCategory; reason?: string }> {
    const name = payload.name.trim();
    if (!name) {
      return { reason: 'category name is required' };
    }

    const delegate = this.categoryDelegate(businessType);
    const duplicated = await delegate.findUnique({ where: { name } });
    if (duplicated) {
      return { reason: 'category already exists' };
    }

    const category = await delegate.create({
      data: {
        id: `${this.businessPrefix(businessType)}cat-${uuid()}`,
        name,
        sortOrder: payload.sortOrder ?? 100,
        createdAt: new Date(),
      },
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'catalog_category.create',
      targetType: `${businessType.toLowerCase()}_category`,
      targetId: category.id,
      metadata: { businessType, name: category.name },
    });

    return { category: this.toProductCategory(businessType, category) };
  }

  async updateProductCategory(
    businessType: BusinessType,
    id: string,
    payload: UpdateProductCategoryRequest,
  ): Promise<{ category?: ProductCategory; reason?: string }> {
    const delegate = this.categoryDelegate(businessType);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return { reason: 'category not found' };
    }

    const nextName = payload.name?.trim();
    if (payload.name !== undefined && !nextName) {
      return { reason: 'category name is required' };
    }
    if (nextName) {
      const duplicated = await delegate.findUnique({ where: { name: nextName } });
      if (duplicated && duplicated.id !== id) {
        return { reason: 'category already exists' };
      }
    }

    const updated = await delegate.update({
      where: { id },
      data: {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
      },
    });

    if (nextName && nextName !== existing.name) {
      await this.productDelegate(businessType).updateMany({
        where: { categoryId: id },
        data: { categoryName: nextName },
      });
    }

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'catalog_category.update',
      targetType: `${businessType.toLowerCase()}_category`,
      targetId: id,
      metadata: { businessType, name: updated.name },
    });

    return { category: this.toProductCategory(businessType, updated) };
  }

  async deleteProductCategory(businessType: BusinessType, id: string): Promise<{ success: boolean; reason?: string }> {
    const delegate = this.categoryDelegate(businessType);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, reason: 'category not found' };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.productDelegate(businessType, tx).updateMany({
        where: { categoryId: id },
        data: { categoryId: null, categoryName: null },
      });
      await this.categoryDelegate(businessType, tx).delete({ where: { id } });
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'catalog_category.delete',
      targetType: `${businessType.toLowerCase()}_category`,
      targetId: id,
      metadata: { businessType, name: existing.name },
    });

    return { success: true };
  }

  async listCatalogProducts(
    businessType: BusinessType,
    options: { includeInactive?: boolean; userId?: string; categoryId?: string } = {},
  ): Promise<CatalogProduct[]> {
    await this.ensureBootstrapData();
    const where: Record<string, unknown> = {};
    if (!options.includeInactive) {
      where.isActive = true;
    }
    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }
    const products = await this.productDelegate(businessType).findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return products.map((item: DbCatalogProduct) => this.toCatalogProduct(businessType, item));
  }

  async createCatalogProduct(
    businessType: BusinessType,
    payload: CreateCatalogProductRequest,
  ): Promise<{ product?: CatalogProduct; reason?: string }> {
    const prepared = await this.prepareCatalogProductInput(businessType, payload);
    if (prepared.reason) {
      return { reason: prepared.reason };
    }

    const now = new Date();
    const product = await this.productDelegate(businessType).create({
      data: {
        id: `${this.businessPrefix(businessType)}prod-${uuid()}`,
        ...prepared.data,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'catalog_product.create',
      targetType: `${businessType.toLowerCase()}_product`,
      targetId: product.id,
      metadata: { businessType, name: product.name },
    });

    return { product: this.toCatalogProduct(businessType, product) };
  }

  async updateCatalogProduct(
    businessType: BusinessType,
    id: string,
    payload: UpdateCatalogProductRequest,
  ): Promise<{ product?: CatalogProduct; reason?: string }> {
    const delegate = this.productDelegate(businessType);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return { reason: 'product not found' };
    }

    const prepared = await this.prepareCatalogProductInput(businessType, payload, true);
    if (prepared.reason) {
      return { reason: prepared.reason };
    }

    const updated = await delegate.update({
      where: { id },
      data: {
        ...prepared.data,
        updatedAt: new Date(),
      },
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'catalog_product.update',
      targetType: `${businessType.toLowerCase()}_product`,
      targetId: updated.id,
      metadata: { businessType, name: updated.name },
    });

    return { product: this.toCatalogProduct(businessType, updated) };
  }

  async deleteCatalogProduct(businessType: BusinessType, id: string): Promise<{ success: boolean; reason?: string }> {
    const delegate = this.productDelegate(businessType);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, reason: 'product not found' };
    }

    await delegate.delete({ where: { id } });
    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'catalog_product.delete',
      targetType: `${businessType.toLowerCase()}_product`,
      targetId: id,
      metadata: { businessType, name: existing.name },
    });

    return { success: true };
  }

  async listAppointments(userId?: string, businessType?: BusinessType): Promise<Appointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(businessType ? { businessType } : {}),
      },
      orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'desc' }],
    });
    return this.toAppointmentsWithProductImages(appointments);
  }

  async listAppointmentUnavailableDates(options: {
    businessType?: BusinessType;
    fromDate?: string;
    toDate?: string;
  } = {}): Promise<AppointmentUnavailableDate[]> {
    const fromDate = options.fromDate || this.chinaDateString(new Date());
    const rows = await this.prisma.appointmentUnavailableDate.findMany({
      where: {
        ...(options.businessType
          ? { businessType: { in: ['ALL', options.businessType] } }
          : {}),
        appointmentDate: {
          gte: fromDate,
          ...(options.toDate ? { lte: options.toDate } : {}),
        },
      },
      orderBy: [{ appointmentDate: 'asc' }, { businessType: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      appointmentDate: row.appointmentDate,
      businessType: row.businessType as AppointmentAvailabilityScope,
      reason: row.reason || undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createAppointmentUnavailableDate(
    adminId: string,
    payload: CreateAppointmentUnavailableDateRequest,
  ): Promise<{ unavailableDate?: AppointmentUnavailableDate; reason?: string }> {
    if (!this.isValidDateOnly(payload.appointmentDate)) {
      return { reason: 'invalid appointment date' };
    }
    if (!this.isAppointmentAvailabilityScope(payload.businessType)) {
      return { reason: 'invalid appointment availability scope' };
    }
    if (payload.appointmentDate < this.chinaDateString(new Date())) {
      return { reason: 'appointment unavailable date cannot be in the past' };
    }

    const existing = await this.prisma.appointmentUnavailableDate.findFirst({
      where: {
        appointmentDate: payload.appointmentDate,
        ...(payload.businessType === 'ALL'
          ? {}
          : { businessType: { in: ['ALL', payload.businessType] } }),
      },
    });
    if (existing) {
      return { reason: 'appointment date has unavailable settings' };
    }

    const now = new Date();
    const created = await this.prisma.appointmentUnavailableDate.create({
      data: {
        id: `aud-${uuid()}`,
        appointmentDate: payload.appointmentDate,
        businessType: payload.businessType,
        reason: payload.reason?.trim() || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.writeAudit({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'appointment_unavailable_date.create',
      targetType: 'appointment_unavailable_date',
      targetId: created.id,
      metadata: {
        appointmentDate: created.appointmentDate,
        businessType: created.businessType,
        reason: created.reason,
      },
    });

    return {
      unavailableDate: {
        id: created.id,
        appointmentDate: created.appointmentDate,
        businessType: created.businessType as AppointmentAvailabilityScope,
        reason: created.reason || undefined,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  }

  async deleteAppointmentUnavailableDate(
    id: string,
    adminId: string,
  ): Promise<{ success: boolean; reason?: string }> {
    const existing = await this.prisma.appointmentUnavailableDate.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, reason: 'appointment unavailable date not found' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.appointmentUnavailableDate.delete({ where: { id } });
      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'appointment_unavailable_date.delete',
          targetType: 'appointment_unavailable_date',
          targetId: id,
          metadata: {
            appointmentDate: existing.appointmentDate,
            businessType: existing.businessType,
            reason: existing.reason,
          },
        },
        tx,
      );
    });

    return { success: true };
  }

  async listBookedAppointmentSlots(
    appointmentDate: string,
    _excludeUserId?: string,
    businessType: BusinessType = BUSINESS_TYPE.NAIL,
  ): Promise<BookedAppointmentSlot[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDate,
        businessType,
        status: APPOINTMENT_STATUS.CONFIRMED,
      },
      orderBy: { startTime: 'asc' },
    });

    return appointments.map((item) => ({
      businessType: item.businessType as BusinessType,
      appointmentDate: item.appointmentDate,
      startTime: item.startTime,
      endTime: item.endTime,
    }));
  }

  async createAppointment(
    userId: string,
    payload: CreateAppointmentRequest,
  ): Promise<{ appointment?: Appointment; reason?: string }> {
    const member = await this.prisma.member.findUnique({ where: { id: userId } });
    if (!member) {
      return { reason: 'member not found' };
    }

    const businessType = payload.businessType || BUSINESS_TYPE.NAIL;
    if (!this.isBusinessType(businessType)) {
      return { reason: 'invalid business type' };
    }
    if (!this.isValidDateOnly(payload.appointmentDate)) {
      return { reason: 'invalid appointment date' };
    }

    const productResult = await this.resolveAppointmentProduct(businessType, payload.productId, userId);
    if (productResult.reason) {
      return { reason: productResult.reason };
    }

    if (!this.isAllowedAppointmentTime(payload.startTime) || (payload.endTime && !this.isAllowedAppointmentTime(payload.endTime))) {
      return { reason: 'appointment time must be between 09:00 and 21:00' };
    }

    const endTime = payload.endTime || payload.startTime;
    if (this.isPastAppointmentTime(payload.appointmentDate, payload.startTime)) {
      return { reason: 'appointment time cannot be in the past' };
    }

    if (await this.isAppointmentDateUnavailable(payload.appointmentDate, businessType)) {
      return { reason: 'appointment date unavailable' };
    }

    if (endTime !== payload.startTime && this.timeToMinutes(endTime) <= this.timeToMinutes(payload.startTime)) {
      return { reason: 'appointment end time must be later than start time' };
    }

    if (await this.hasConfirmedAppointmentConflict(businessType, payload.appointmentDate, payload.startTime, endTime)) {
      return { reason: 'appointment time slot already booked' };
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        id: `ap-${uuid()}`,
        userId,
        memberNickname: member.nickname,
        businessType,
        productId: productResult.product?.id || null,
        productName: productResult.product?.name || null,
        appointmentDate: payload.appointmentDate,
        startTime: payload.startTime,
        endTime,
        status: APPOINTMENT_STATUS.PENDING,
        remark: payload.remark?.trim() || null,
        adminRemark: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.writeAudit({
      actorId: userId,
      actorRole: 'MEMBER',
      action: 'appointment.create',
      targetType: 'appointment',
      targetId: appointment.id,
      metadata: {
        appointmentDate: appointment.appointmentDate,
        businessType: appointment.businessType,
        productId: appointment.productId,
        productName: appointment.productName,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      },
    });

    return { appointment: this.toAppointment(appointment, productResult.product?.images) };
  }

  async createAdminAppointment(
    adminId: string,
    payload: CreateAdminAppointmentRequest,
  ): Promise<{ appointment?: Appointment; reason?: string }> {
    const member = await this.prisma.member.findUnique({ where: { id: payload.userId } });
    if (!member) {
      return { reason: 'member not found' };
    }

    const businessType = payload.businessType || BUSINESS_TYPE.NAIL;
    if (!this.isBusinessType(businessType)) {
      return { reason: 'invalid business type' };
    }
    if (!this.isValidDateOnly(payload.appointmentDate)) {
      return { reason: 'invalid appointment date' };
    }

    const productResult = await this.resolveAppointmentProduct(businessType, payload.productId, payload.userId);
    if (productResult.reason) {
      return { reason: productResult.reason };
    }

    if (!this.isAllowedAppointmentTime(payload.startTime) || (payload.endTime && !this.isAllowedAppointmentTime(payload.endTime))) {
      return { reason: 'appointment time must be between 09:00 and 21:00' };
    }

    const endTime = payload.endTime || payload.startTime;
    if (this.isPastAppointmentTime(payload.appointmentDate, payload.startTime)) {
      return { reason: 'appointment time cannot be in the past' };
    }

    if (endTime !== payload.startTime && this.timeToMinutes(endTime) <= this.timeToMinutes(payload.startTime)) {
      return { reason: 'appointment end time must be later than start time' };
    }

    const status = payload.status || APPOINTMENT_STATUS.CONFIRMED;
    const adminRemark = payload.adminRemark?.trim();
    if (status === APPOINTMENT_STATUS.CANCELLED && !adminRemark) {
      return { reason: 'reject reason is required' };
    }

    if (status === APPOINTMENT_STATUS.CONFIRMED) {
      if (await this.hasConfirmedAppointmentConflict(businessType, payload.appointmentDate, payload.startTime, endTime)) {
        return { reason: 'appointment time slot already booked' };
      }
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        id: `ap-${uuid()}`,
        userId: payload.userId,
        memberNickname: member.nickname,
        businessType,
        productId: productResult.product?.id || null,
        productName: productResult.product?.name || null,
        appointmentDate: payload.appointmentDate,
        startTime: payload.startTime,
        endTime,
        status,
        remark: payload.remark?.trim() || null,
        adminRemark: adminRemark || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.writeAudit({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'appointment.admin.create',
      targetType: 'appointment',
      targetId: appointment.id,
      metadata: {
        userId: appointment.userId,
        businessType: appointment.businessType,
        productId: appointment.productId,
        productName: appointment.productName,
        appointmentDate: appointment.appointmentDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      },
    });

    if (businessType === BUSINESS_TYPE.ACCESSORY && status === APPOINTMENT_STATUS.CONFIRMED && appointment.productId) {
      await this.deactivateAccessoryAfterAcceptance(appointment.productId);
    }

    return { appointment: this.toAppointment(appointment, productResult.product?.images) };
  }

  async updateAppointment(
    id: string,
    payload: UpdateAppointmentRequest,
  ): Promise<{ appointment?: Appointment; reason?: string }> {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return { reason: 'appointment not found' };
    }

    const nextAdminRemark = payload.adminRemark?.trim();
    const nextStatus = payload.status || (existing.status as AppointmentStatus);
    const nextUserId = payload.userId?.trim() || existing.userId;
    const nextBusinessType = payload.businessType || (existing.businessType as BusinessType);
    const nextAppointmentDate = payload.appointmentDate || existing.appointmentDate;
    const nextStartTime = payload.startTime || existing.startTime;
    const nextEndTime = payload.endTime || (payload.startTime ? payload.startTime : existing.endTime);

    if (!this.isBusinessType(nextBusinessType)) {
      return { reason: 'invalid business type' };
    }
    if (!this.isValidDateOnly(nextAppointmentDate)) {
      return { reason: 'invalid appointment date' };
    }

    if (payload.userId && payload.userId !== existing.userId) {
      const member = await this.prisma.member.findUnique({ where: { id: payload.userId } });
      if (!member) {
        return { reason: 'member not found' };
      }

    }

    const shouldResolveProduct = payload.productId !== undefined || payload.businessType !== undefined || payload.userId !== undefined;
    const productResult = shouldResolveProduct
      ? await this.resolveAppointmentProduct(nextBusinessType, payload.productId === undefined ? existing.productId : payload.productId, nextUserId)
      : { product: existing.productId ? { id: existing.productId, name: existing.productName || '', images: [] } : undefined };
    if ('reason' in productResult && productResult.reason) {
      return { reason: productResult.reason };
    }

    if (!this.isAllowedAppointmentTime(nextStartTime) || !this.isAllowedAppointmentTime(nextEndTime)) {
      return { reason: 'appointment time must be between 09:00 and 21:00' };
    }
    if (
      (payload.appointmentDate !== undefined ||
        payload.startTime !== undefined ||
        (payload.status === APPOINTMENT_STATUS.CONFIRMED && existing.status !== APPOINTMENT_STATUS.CONFIRMED)) &&
      this.isPastAppointmentTime(nextAppointmentDate, nextStartTime)
    ) {
      return { reason: 'appointment time cannot be in the past' };
    }
    if (nextEndTime !== nextStartTime && this.timeToMinutes(nextEndTime) <= this.timeToMinutes(nextStartTime)) {
      return { reason: 'appointment end time must be later than start time' };
    }

    if (payload.status === APPOINTMENT_STATUS.CANCELLED && !nextAdminRemark) {
      return { reason: 'reject reason is required' };
    }

    if (payload.status === APPOINTMENT_STATUS.COMPLETED && existing.status !== APPOINTMENT_STATUS.CONFIRMED) {
      return { reason: 'only confirmed appointment can be completed' };
    }

    if (
      nextBusinessType === BUSINESS_TYPE.ACCESSORY &&
      nextStatus === APPOINTMENT_STATUS.CONFIRMED &&
      existing.status !== APPOINTMENT_STATUS.CONFIRMED
    ) {
      const accessoryProductId = productResult.product?.id || existing.productId;
      if (!accessoryProductId) {
        return { reason: 'accessory appointment requires a product' };
      }
      const accessoryProduct = await this.prisma.accessoryProduct.findUnique({ where: { id: accessoryProductId } });
      if (!accessoryProduct?.isActive) {
        return { reason: 'product is not available' };
      }
    }

    if (nextStatus === APPOINTMENT_STATUS.CONFIRMED) {
      if (
        await this.hasConfirmedAppointmentConflict(
          nextBusinessType,
          nextAppointmentDate,
          nextStartTime,
          nextEndTime,
          existing.id,
        )
      ) {
        return { reason: 'appointment time slot already booked' };
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(payload.userId !== undefined
          ? {
              userId: nextUserId,
              memberNickname: (await this.prisma.member.findUnique({ where: { id: nextUserId } }))?.nickname || existing.memberNickname,
            }
          : {}),
        ...(payload.businessType !== undefined ? { businessType: nextBusinessType } : {}),
        ...(shouldResolveProduct
          ? {
              productId: productResult.product?.id || null,
              productName: productResult.product?.name || null,
            }
          : {}),
        ...(payload.appointmentDate !== undefined ? { appointmentDate: nextAppointmentDate } : {}),
        ...(payload.startTime !== undefined ? { startTime: nextStartTime, endTime: nextEndTime } : {}),
        ...(payload.endTime !== undefined && payload.startTime === undefined ? { endTime: nextEndTime } : {}),
        ...(payload.remark !== undefined ? { remark: payload.remark.trim() || null } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.adminRemark !== undefined ? { adminRemark: nextAdminRemark || null } : {}),
        updatedAt: new Date(),
      },
    });

    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'appointment.update',
      targetType: 'appointment',
      targetId: id,
      metadata: {
        userId: updated.userId,
        businessType: updated.businessType,
        productId: updated.productId,
        productName: updated.productName,
        appointmentDate: updated.appointmentDate,
        startTime: updated.startTime,
        endTime: updated.endTime,
        status: updated.status,
        adminRemark: updated.adminRemark,
      },
    });

    if (updated.businessType === BUSINESS_TYPE.ACCESSORY && updated.status === APPOINTMENT_STATUS.CONFIRMED && updated.productId) {
      await this.deactivateAccessoryAfterAcceptance(updated.productId);
    }

    return { appointment: (await this.toAppointmentsWithProductImages([updated]))[0] };
  }

  async deleteAppointment(id: string, adminId: string): Promise<{ success: boolean; reason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({ where: { id } });
      if (!appointment) {
        return { success: false, reason: 'appointment not found' };
      }

      await tx.appointment.delete({ where: { id } });
      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'appointment.delete',
          targetType: 'appointment',
          targetId: id,
          metadata: {
            userId: appointment.userId,
            memberNickname: appointment.memberNickname,
            businessType: appointment.businessType,
            productId: appointment.productId,
            productName: appointment.productName,
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.startTime,
            status: appointment.status,
          },
        },
        tx,
      );

      return { success: true };
    });
  }

  async listLevels(): Promise<MemberLevel[]> {
    await this.ensureBootstrapData();
    const levels = await this.prisma.memberLevel.findMany({ orderBy: { minPoints: 'asc' } });
    return levels.map((level) => this.toMemberLevel(level));
  }

  async createLevel(payload: CreateMemberLevelRequest): Promise<MemberLevel> {
    const level = await this.prisma.$transaction(async (tx) => {
      const created = await tx.memberLevel.create({
        data: {
          id: `level-${uuid()}`,
          name: payload.name.trim(),
          minPoints: payload.minPoints,
          discountRate: payload.discountRate,
        },
      });

      await this.writeAudit(
        {
          actorId: 'admin-001',
          actorRole: 'ADMIN',
          action: 'member_level.create',
          targetType: 'member_level',
          targetId: created.id,
          metadata: { name: created.name, minPoints: created.minPoints, discountRate: created.discountRate },
        },
        tx,
      );

      return created;
    });
    return this.toMemberLevel(level);
  }

  async updateLevel(levelId: string, payload: UpdateMemberLevelRequest): Promise<MemberLevel | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const level = await tx.memberLevel.findUnique({ where: { id: levelId } });
      if (!level) {
        return undefined;
      }

      const before = { ...this.toMemberLevel(level) };
      const updated = await tx.memberLevel.update({
        where: { id: levelId },
        data: {
          ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
          ...(payload.minPoints !== undefined ? { minPoints: payload.minPoints } : {}),
          ...(payload.discountRate !== undefined ? { discountRate: payload.discountRate } : {}),
        },
      });
      const after = { ...this.toMemberLevel(updated) };

      await tx.member.updateMany({
        where: { levelId },
        data: {
          levelName: updated.name,
          ...(payload.discountRate !== undefined ? { discountRate: updated.discountRate } : {}),
        },
      });

      await this.writeAudit(
        {
          actorId: 'admin-001',
          actorRole: 'ADMIN',
          action: 'member_level.update',
          targetType: 'member_level',
          targetId: levelId,
          metadata: { changes: this.diffSnapshot(before, after) },
        },
        tx,
      );

      return after;
    });
  }

  async deleteLevel(levelId: string): Promise<{ success: boolean; reason?: string }> {
    const level = await this.prisma.memberLevel.findUnique({ where: { id: levelId } });
    if (!level) {
      return { success: false, reason: 'level not found' };
    }

    const levelCount = await this.prisma.memberLevel.count();
    if (levelCount <= 1) {
      return { success: false, reason: 'at least one level is required' };
    }

    const memberCount = await this.prisma.member.count({ where: { levelId } });
    if (memberCount > 0) {
      return { success: false, reason: 'level is used by members' };
    }

    await this.prisma.memberLevel.delete({ where: { id: levelId } });
    await this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'member_level.delete',
      targetType: 'member_level',
      targetId: levelId,
      metadata: { name: level.name, minPoints: level.minPoints, discountRate: level.discountRate },
    });

    return { success: true };
  }

  async updateMember(
    memberId: string,
    payload: UpdateMemberRequest,
  ): Promise<{ member?: MemberProfile; reason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) {
        return { reason: 'member not found' };
      }

      if (payload.birthday !== undefined && !this.isValidBirthdayMonthDay(payload.birthday)) {
        return { reason: 'birthday must use valid MM-DD format' };
      }

      const before = this.memberSnapshot(member);
      let nextLevel: MemberLevel | undefined;
      if (payload.levelId !== undefined) {
        const level = await tx.memberLevel.findUnique({ where: { id: payload.levelId } });
        if (!level) {
          return { reason: 'level not found' };
        }
        nextLevel = this.toMemberLevel(level);
      }

      const updated = await tx.member.update({
        where: { id: member.id },
        data: {
          ...(payload.nickname !== undefined ? { nickname: payload.nickname } : {}),
          ...(payload.remark !== undefined ? { remark: payload.remark.trim() || null } : {}),
          ...(payload.birthday !== undefined ? { birthday: payload.birthday } : {}),
          ...(payload.points !== undefined ? { points: this.round2(payload.points) } : {}),
          ...(payload.balance !== undefined ? { balance: this.round2(payload.balance) } : {}),
          ...(nextLevel
            ? {
                levelId: nextLevel.id,
                levelName: nextLevel.name,
                ...(payload.discountRate === undefined ? { discountRate: nextLevel.discountRate } : {}),
              }
            : {}),
          ...(payload.discountRate !== undefined ? { discountRate: payload.discountRate } : {}),
        },
      });

      if (payload.nickname !== undefined) {
        await tx.appointment.updateMany({
          where: { userId: updated.id },
          data: { memberNickname: updated.nickname },
        });
      }

      const after = this.memberSnapshot(updated);
      await this.writeAudit(
        {
          actorId: 'admin-001',
          actorRole: 'ADMIN',
          action: 'member.update',
          targetType: 'member',
          targetId: updated.id,
          metadata: {
            changes: this.diffSnapshot(before, after),
          },
        },
        tx,
      );

      return { member: this.toMemberProfile(updated) };
    });
  }

  async deleteMember(
    memberId: string,
    adminId: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) {
        return { success: false, reason: 'member not found' };
      }

      if (Math.abs(member.balance) > 0.001 || Math.abs(member.points) > 0.001) {
        return { success: false, reason: 'member has remaining assets' };
      }

      const [activeAppointmentCount, pendingRechargeCount] = await Promise.all([
        tx.appointment.count({
          where: {
            userId: memberId,
            status: { in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
          },
        }),
        tx.rechargeOrder.count({
          where: {
            userId: memberId,
            status: RECHARGE_STATUS.PENDING,
          },
        }),
      ]);

      if (activeAppointmentCount > 0) {
        return { success: false, reason: 'member has active appointments' };
      }
      if (pendingRechargeCount > 0) {
        return { success: false, reason: 'member has pending recharge' };
      }

      const [appointmentCount, rechargeCount, consumptionCount, ledgerCount] = await Promise.all([
        tx.appointment.count({ where: { userId: memberId } }),
        tx.rechargeOrder.count({ where: { userId: memberId } }),
        tx.consumptionOrder.count({ where: { userId: memberId } }),
        tx.balanceLedger.count({ where: { userId: memberId } }),
      ]);

      await tx.member.delete({ where: { id: memberId } });
      await this.writeAudit(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'member.delete',
          targetType: 'member',
          targetId: memberId,
          metadata: {
            nickname: member.nickname,
            appointmentCount,
            rechargeCount,
            consumptionCount,
            ledgerCount,
          },
        },
        tx,
      );

      return { success: true };
    });
  }

  async updateMemberSelf(
    memberId: string,
    payload: UpdateMyProfileRequest,
  ): Promise<{ member?: MemberProfile; reason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) {
        return { reason: 'member not found' };
      }

      const before = {
        id: member.id,
        phone: member.phone || undefined,
        birthday: member.birthday || undefined,
        nickname: member.nickname,
      };

      const nextBirthday = payload.birthday?.trim();
      if (nextBirthday && !this.isValidBirthdayMonthDay(nextBirthday)) {
        return { reason: 'birthday must use valid MM-DD format' };
      }
      if (nextBirthday && member.birthday && nextBirthday !== member.birthday) {
        return { reason: 'birthday can only be changed once' };
      }

      const phone = payload.phone?.trim();
      const nickname = payload.nickname?.trim();
      if (payload.nickname !== undefined && !nickname) {
        return { reason: 'nickname is required' };
      }
      if (phone) {
        const duplicated = await tx.member.findFirst({
          where: {
            phone,
            NOT: { id: member.id },
          },
        });
        if (duplicated) {
          return { reason: 'phone already bound by another member' };
        }
      }

      const updated = await tx.member.update({
        where: { id: member.id },
        data: {
          ...(phone ? { phone } : {}),
          ...(nextBirthday ? { birthday: nextBirthday } : {}),
          ...(nickname ? { nickname } : {}),
        },
      });

      const after = {
        id: updated.id,
        phone: updated.phone || undefined,
        birthday: updated.birthday || undefined,
        nickname: updated.nickname,
      };

      await this.writeAudit(
        {
          actorId: updated.id,
          actorRole: 'MEMBER',
          action: 'member.self.update',
          targetType: 'member',
          targetId: updated.id,
          metadata: {
            originMemberId: memberId,
            changes: this.diffSnapshot(before, after),
          },
        },
        tx,
      );

      return { member: this.toMemberProfile(updated) };
    });
  }

  async updateMemberAvatar(
    memberId: string,
    avatarUrl: string,
  ): Promise<{ member?: MemberProfile; reason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) {
        return { reason: 'member not found' };
      }

      const updated = await tx.member.update({
        where: { id: memberId },
        data: { avatarUrl },
      });

      await this.writeAudit(
        {
          actorId: memberId,
          actorRole: 'MEMBER',
          action: 'member.avatar.update',
          targetType: 'member',
          targetId: memberId,
          metadata: {
            changes: this.diffSnapshot(
              { avatarUrl: member.avatarUrl },
              { avatarUrl: updated.avatarUrl },
            ),
          },
        },
        tx,
      );

      return { member: this.toMemberProfile(updated) };
    });
  }

  async listAuditLogs(): Promise<AuditLog[]> {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
    return logs.map((log) => this.toAuditLog(log));
  }

  private async ensureBootstrapData(): Promise<void> {
    const [
      levelCount,
      adminCount,
      productTypeCount,
      nailCategoryCount,
      accessoryCategoryCount,
      flowerCategoryCount,
      nailProductCount,
      accessoryProductCount,
      flowerProductCount,
    ] = await Promise.all([
      this.prisma.memberLevel.count(),
      this.prisma.adminUser.count(),
      this.prisma.productType.count(),
      this.prisma.nailCategory.count(),
      this.prisma.accessoryCategory.count(),
      this.prisma.flowerCategory.count(),
      this.prisma.nailProduct.count(),
      this.prisma.accessoryProduct.count(),
      this.prisma.flowerProduct.count(),
    ]);
    const seed = createDefaultStore();
    const shouldSeedDemoCatalog = process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_CATALOG !== 'false';

    if (levelCount === 0) {
      await this.prisma.memberLevel.createMany({ data: seed.memberLevels });
    }

    if (adminCount === 0) {
      await this.prisma.adminUser.createMany({ data: seed.admins });
    }

    if (productTypeCount === 0) {
      await this.prisma.productType.createMany({
        data: seed.productTypes.map((item) => this.productTypeToDb(item)),
      });
    }

    if (nailCategoryCount === 0) {
      await this.prisma.nailCategory.createMany({
        data: seed.productCategories
          .filter((item) => item.businessType === BUSINESS_TYPE.NAIL)
          .map((item) => this.productCategoryToDb(item)),
      });
    }

    if (accessoryCategoryCount === 0) {
      await this.prisma.accessoryCategory.createMany({
        data: seed.productCategories
          .filter((item) => item.businessType === BUSINESS_TYPE.ACCESSORY)
          .map((item) => this.productCategoryToDb(item)),
      });
    }

    if (flowerCategoryCount === 0) {
      await this.prisma.flowerCategory.createMany({
        data: seed.productCategories
          .filter((item) => item.businessType === BUSINESS_TYPE.FLOWER)
          .map((item) => this.productCategoryToDb(item)),
      });
    }

    if (shouldSeedDemoCatalog && nailProductCount === 0) {
      await this.prisma.nailProduct.createMany({
        data: seed.catalogProducts
          .filter((item) => item.businessType === BUSINESS_TYPE.NAIL)
          .map((item) => this.catalogProductToDb(item)),
      });
    }

    if (shouldSeedDemoCatalog && accessoryProductCount === 0) {
      await this.prisma.accessoryProduct.createMany({
        data: seed.catalogProducts
          .filter((item) => item.businessType === BUSINESS_TYPE.ACCESSORY)
          .map((item) => this.catalogProductToDb(item)),
      });
    }

    if (shouldSeedDemoCatalog && flowerProductCount === 0) {
      await this.prisma.flowerProduct.createMany({
        data: seed.catalogProducts
          .filter((item) => item.businessType === BUSINESS_TYPE.FLOWER)
          .map((item) => this.catalogProductToDb(item)),
      });
    }
  }

  private async getMatchedLevel(points: number, client: any = this.prisma): Promise<MemberLevel | undefined> {
    const level = await client.memberLevel.findFirst({
      where: { minPoints: { lte: points } },
      orderBy: { minPoints: 'desc' },
    });
    return level ? this.toMemberLevel(level) : undefined;
  }

  private async getDiscountRateByLevel(levelId: string, client: any = this.prisma): Promise<number | undefined> {
    const level = await client.memberLevel.findUnique({ where: { id: levelId } });
    return level?.discountRate;
  }

  private compactDate(dateString: string): string {
    return dateString.replace(/-/g, '');
  }

  private localDateString(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private chinaDateString(date: Date): string {
    return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private isValidDateOnly(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  private isAppointmentAvailabilityScope(value: string): value is AppointmentAvailabilityScope {
    return value === 'ALL' || this.isBusinessType(value);
  }

  private async isAppointmentDateUnavailable(
    appointmentDate: string,
    businessType: BusinessType,
  ): Promise<boolean> {
    const unavailableDate = await this.prisma.appointmentUnavailableDate.findFirst({
      where: {
        appointmentDate,
        businessType: { in: ['ALL', businessType] },
      },
      select: { id: true },
    });
    return Boolean(unavailableDate);
  }

  private createDailyCode(prefix: string, dateString: string, existingCodes: string[]): string {
    const compact = this.compactDate(dateString);
    const matched = existingCodes
      .filter((code) => code.startsWith(`${prefix}${compact}`))
      .map((code) => Number(code.slice(prefix.length + compact.length)))
      .filter((num) => Number.isFinite(num));

    const nextSeq = (matched.length ? Math.max(...matched) : 0) + 1;
    return `${prefix}${compact}${String(nextSeq).padStart(4, '0')}`;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private timeToMinutes(time: string): number {
    const [hour, minute] = time.split(':').map((part) => Number(part));
    return hour * 60 + minute;
  }

  private isAllowedAppointmentTime(time: string): boolean {
    const minutes = this.timeToMinutes(time);
    return minutes >= 9 * 60 && minutes <= 21 * 60;
  }

  private isPastAppointmentTime(appointmentDate: string, startTime: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointmentDate);
    if (!match) return true;

    const [hour, minute] = startTime.split(':').map((part) => Number(part));
    const appointmentAt = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      hour,
      minute,
      0,
      0,
    );
    return appointmentAt.getTime() <= Date.now();
  }

  private isValidBirthdayMonthDay(value: string): boolean {
    const match = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
    if (!match) return false;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const maxDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= maxDays[month - 1];
  }

  private async hasConfirmedAppointmentConflict(
    businessType: BusinessType,
    appointmentDate: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const confirmed = await this.prisma.appointment.findMany({
      where: {
        businessType,
        appointmentDate,
        status: APPOINTMENT_STATUS.CONFIRMED,
        ...(excludeAppointmentId ? { NOT: { id: excludeAppointmentId } } : {}),
      },
      select: { startTime: true, endTime: true },
    });

    const targetStart = this.timeToMinutes(startTime);
    const targetEnd = this.appointmentEndMinutes(startTime, endTime);
    return confirmed.some((item) => {
      const occupiedStart = this.timeToMinutes(item.startTime);
      const occupiedEnd = this.appointmentEndMinutes(item.startTime, item.endTime);
      return targetStart < occupiedEnd && targetEnd > occupiedStart;
    });
  }

  private appointmentEndMinutes(startTime: string, endTime: string): number {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    return end > start ? end : start + 30;
  }

  private isBusinessType(value: string): value is BusinessType {
    return Object.values(BUSINESS_TYPE).includes(value as BusinessType);
  }

  private businessPrefix(businessType: BusinessType): string {
    const map: Record<BusinessType, string> = {
      [BUSINESS_TYPE.NAIL]: 'nail-',
      [BUSINESS_TYPE.ACCESSORY]: 'accessory-',
      [BUSINESS_TYPE.FLOWER]: 'flower-',
    };
    return map[businessType];
  }

  private categoryDelegate(businessType: BusinessType, client: any = this.prisma): any {
    const map: Record<BusinessType, any> = {
      [BUSINESS_TYPE.NAIL]: client.nailCategory,
      [BUSINESS_TYPE.ACCESSORY]: client.accessoryCategory,
      [BUSINESS_TYPE.FLOWER]: client.flowerCategory,
    };
    return map[businessType];
  }

  private productDelegate(businessType: BusinessType, client: any = this.prisma): any {
    const map: Record<BusinessType, any> = {
      [BUSINESS_TYPE.NAIL]: client.nailProduct,
      [BUSINESS_TYPE.ACCESSORY]: client.accessoryProduct,
      [BUSINESS_TYPE.FLOWER]: client.flowerProduct,
    };
    return map[businessType];
  }

  private async prepareCatalogProductInput(
    businessType: BusinessType,
    payload: CreateCatalogProductRequest | UpdateCatalogProductRequest,
    partial = false,
  ): Promise<{ data?: Record<string, unknown>; reason?: string }> {
    const data: Record<string, unknown> = {};
    const name = payload.name?.trim();
    if (!partial || payload.name !== undefined) {
      if (!name) return { reason: 'product name is required' };
      data.name = name;
    }

    if (payload.categoryId !== undefined) {
      const categoryId = payload.categoryId || null;
      if (categoryId) {
        const category = await this.categoryDelegate(businessType).findUnique({ where: { id: categoryId } });
        if (!category) {
          return { reason: 'category not found' };
        }
        data.categoryId = category.id;
        data.categoryName = category.name;
      } else {
        data.categoryId = null;
        data.categoryName = null;
      }
    }

    if (payload.description !== undefined) {
      data.description = payload.description?.trim() || null;
    }
    if (payload.referencePrice !== undefined) {
      const price = payload.referencePrice;
      if (price !== null && price < 0) {
        return { reason: 'reference price must be greater than or equal to 0' };
      }
      data.referencePrice = price === null ? null : this.round2(price);
    }
    if (payload.images !== undefined) {
      data.images = payload.images.filter((url) => url && url.trim()).slice(0, 9);
    } else if (!partial) {
      data.images = [];
    }
    if (payload.sortOrder !== undefined) {
      data.sortOrder = payload.sortOrder;
    } else if (!partial) {
      data.sortOrder = 100;
    }
    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    } else if (!partial) {
      data.isActive = true;
    }

    return { data };
  }

  private async resolveAppointmentProduct(
    businessType: BusinessType,
    productId: string | null | undefined,
    userId: string,
  ): Promise<{ product?: { id: string; name: string; images: string[] }; reason?: string }> {
    if (!productId) {
      if (businessType === BUSINESS_TYPE.ACCESSORY) {
        return { reason: 'accessory appointment requires a product' };
      }
      return {};
    }

    const product = (await this.productDelegate(businessType).findUnique({ where: { id: productId } })) as
      | DbCatalogProduct
      | null;
    if (!product) {
      return { reason: 'product not found' };
    }
    if (!product.isActive) {
      return { reason: 'product is not available' };
    }
    return { product: { id: product.id, name: product.name, images: product.images } };
  }

  private async deactivateAccessoryAfterAcceptance(productId: string): Promise<void> {
    await this.prisma.accessoryProduct.update({
      where: { id: productId },
      data: {
        isActive: false,
        reservedByUserId: null,
        reservedAppointmentId: null,
        reservedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  private async writeAudit(entry: Omit<AuditLog, 'id' | 'createdAt'>, client: any = this.prisma): Promise<void> {
    await client.auditLog.create({
      data: {
        id: `log-${uuid()}`,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        createdAt: new Date(),
      },
    });
  }

  private toMemberProfile(member: DbMember): MemberProfile {
    return {
      id: member.id,
      openId: member.openId,
      phone: member.phone || undefined,
      nickname: member.nickname,
      remark: member.remark || undefined,
      avatarUrl: member.avatarUrl,
      birthday: member.birthday || undefined,
      levelId: member.levelId,
      levelName: member.levelName,
      discountRate: member.discountRate,
      balance: member.balance,
      points: member.points,
    };
  }

  private toMemberLevel(level: DbMemberLevel): MemberLevel {
    return {
      id: level.id,
      name: level.name,
      minPoints: level.minPoints,
      discountRate: level.discountRate,
    };
  }

  private toRechargeOrder(order: DbRechargeOrder): RechargeOrder {
    return {
      id: order.id,
      userId: order.userId,
      amount: order.amount,
      status: order.status as RechargeStatus,
      rejectReason: order.rejectReason || undefined,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private toConsumptionOrder(order: DbConsumptionOrder): ConsumptionOrder {
    return {
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      productType: order.productType || undefined,
      title: order.title,
      originalPrice: order.originalPrice,
      finalPrice: order.finalPrice,
      discountRate: order.discountRate,
      effectImages: order.effectImages,
      orderDate: order.orderDate,
      remark: order.remark || undefined,
      createdBy: order.createdBy,
      createdAt: order.createdAt.toISOString(),
    };
  }

  private toProductType(item: DbProductType): ProductType {
    return {
      id: item.id,
      name: item.name,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toProductCategory(businessType: BusinessType, item: DbProductCategory): ProductCategory {
    return {
      id: item.id,
      businessType,
      name: item.name,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toCatalogProduct(businessType: BusinessType, item: DbCatalogProduct): CatalogProduct {
    return {
      id: item.id,
      businessType,
      categoryId: item.categoryId || undefined,
      categoryName: item.categoryName || undefined,
      name: item.name,
      description: item.description || undefined,
      referencePrice: item.referencePrice ?? undefined,
      images: item.images,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      reservedByUserId: item.reservedByUserId || undefined,
      reservedAppointmentId: item.reservedAppointmentId || undefined,
      reservedAt: item.reservedAt?.toISOString() || undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async toAppointmentsWithProductImages(items: DbAppointment[]): Promise<Appointment[]> {
    const productIdsByBusiness = new Map<BusinessType, Set<string>>();
    for (const item of items) {
      if (!item.productId || !this.isBusinessType(item.businessType)) continue;
      const businessType = item.businessType as BusinessType;
      productIdsByBusiness.set(businessType, productIdsByBusiness.get(businessType) || new Set<string>());
      productIdsByBusiness.get(businessType)?.add(item.productId);
    }

    const imageMap = new Map<string, string[]>();
    for (const [businessType, productIds] of productIdsByBusiness.entries()) {
      const products = (await this.productDelegate(businessType).findMany({
        where: { id: { in: Array.from(productIds) } },
      })) as DbCatalogProduct[];
      for (const product of products) {
        imageMap.set(`${businessType}:${product.id}`, product.images);
      }
    }

    return items.map((item) => {
      const businessType = this.isBusinessType(item.businessType) ? item.businessType : BUSINESS_TYPE.NAIL;
      return this.toAppointment(item, item.productId ? imageMap.get(`${businessType}:${item.productId}`) : undefined);
    });
  }

  private toAppointment(item: DbAppointment, productImages?: string[]): Appointment {
    return {
      id: item.id,
      userId: item.userId,
      memberNickname: item.memberNickname,
      businessType: this.isBusinessType(item.businessType) ? item.businessType : BUSINESS_TYPE.NAIL,
      productId: item.productId || undefined,
      productName: item.productName || undefined,
      productImages: productImages?.length ? productImages : undefined,
      appointmentDate: item.appointmentDate,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status as Appointment['status'],
      remark: item.remark || undefined,
      adminRemark: item.adminRemark || undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toAuditLog(log: DbAuditLog): AuditLog {
    return {
      id: log.id,
      actorId: log.actorId,
      actorRole: log.actorRole as 'ADMIN' | 'MEMBER',
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: (log.metadata || undefined) as Record<string, unknown> | undefined,
      createdAt: log.createdAt.toISOString(),
    };
  }

  private toAdminUser(admin: DbAdminUser): AdminUser {
    return {
      id: admin.id,
      name: admin.name,
      role: admin.role as AdminUser['role'],
    };
  }

  private memberToDb(member: MemberProfile): DbMember {
    return {
      id: member.id,
      openId: member.openId,
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
      levelId: member.levelId,
      levelName: member.levelName,
      discountRate: member.discountRate,
      balance: member.balance,
      points: member.points,
      phone: member.phone || null,
      remark: member.remark || null,
      birthday: member.birthday || null,
      accountIdChangedAt: null,
    };
  }

  private rechargeToDb(order: RechargeOrder): DbRechargeOrder {
    return {
      ...order,
      rejectReason: order.rejectReason || null,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
    };
  }

  private consumptionToDb(order: ConsumptionOrder): DbConsumptionOrder {
    return {
      ...order,
      productType: order.productType || null,
      remark: order.remark || null,
      createdAt: new Date(order.createdAt),
    };
  }

  private productTypeToDb(item: ProductType): DbProductType {
    return {
      ...item,
      createdAt: new Date(item.createdAt),
    };
  }

  private productCategoryToDb(item: ProductCategory): DbProductCategory {
    return {
      id: item.id,
      name: item.name,
      sortOrder: item.sortOrder,
      createdAt: new Date(item.createdAt),
    };
  }

  private catalogProductToDb(item: CatalogProduct): DbCatalogProduct {
    const base = {
      id: item.id,
      categoryId: item.categoryId || null,
      categoryName: item.categoryName || null,
      name: item.name,
      description: item.description || null,
      referencePrice: item.referencePrice ?? null,
      images: item.images,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    };

    if (item.businessType !== BUSINESS_TYPE.ACCESSORY) {
      return base;
    }

    return {
      ...base,
      reservedByUserId: item.reservedByUserId || null,
      reservedAppointmentId: item.reservedAppointmentId || null,
      reservedAt: item.reservedAt ? new Date(item.reservedAt) : null,
    };
  }

  private ledgerToDb(ledger: BalanceLedger): DbBalanceLedger {
    return {
      ...ledger,
      relatedOrderId: ledger.relatedOrderId || null,
      createdAt: new Date(ledger.createdAt),
    };
  }

  private auditToDb(log: AuditLog): Omit<DbAuditLog, 'metadata'> & { metadata?: Prisma.InputJsonValue } {
    return {
      ...log,
      metadata: log.metadata as Prisma.InputJsonValue | undefined,
      createdAt: new Date(log.createdAt),
    };
  }

  private memberSnapshot(member: DbMember): Record<string, unknown> {
    return {
      id: member.id,
      nickname: member.nickname,
      remark: member.remark || undefined,
      birthday: member.birthday || undefined,
      levelId: member.levelId,
      levelName: member.levelName,
      discountRate: member.discountRate,
      balance: member.balance,
      points: member.points,
    };
  }

  private async generateMemberNumber(): Promise<string> {
    const now = new Date();
    const datePart = [
      String(now.getFullYear()).slice(-2),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const randomPart = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
      const memberNumber = `MI${datePart}${randomPart}`;
      const existing = await this.prisma.member.findUnique({ where: { id: memberNumber } });
      if (!existing) return memberNumber;
    }

    return `MI${Date.now()}`;
  }

  private diffSnapshot(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { from: unknown; to: unknown }> {
    return Object.fromEntries(
      Object.entries(after)
        .filter(([key, value]) => !Object.is(before[key], value))
        .map(([key, value]) => [key, { from: before[key], to: value }]),
    );
  }
}
