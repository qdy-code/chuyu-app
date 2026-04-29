import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  AuditLog,
  APPOINTMENT_STATUS,
  Appointment,
  AppointmentStatus,
  BalanceLedger,
  BookedAppointmentSlot,
  CreateAdminAppointmentRequest,
  ConsumptionOrder,
  CreateAppointmentRequest,
  CreateConsumptionOrderRequest,
  CreateMemberRequest,
  CreateMemberLevelRequest,
  CreateProductTypeRequest,
  MemberLevel,
  MemberProfile,
  ProductType,
  RechargeApplyRequest,
  RechargeOrder,
  RechargeStatus,
  RECHARGE_STATUS,
  RejectRechargeRequest,
  UpdateMyProfileRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
  UpdateAppointmentRequest,
  UpdateProductTypeRequest,
  WechatLoginRequest,
} from '@member-platform/shared';
import { AdminUser, createDefaultStore, DataStore, isFinalStatus } from './types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from './prisma.service';

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

type DbAppointment = {
  id: string;
  userId: string;
  memberNickname: string;
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
      await tx.appointment.deleteMany();
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

    const memberId = payload.id?.trim() || `u-${uuid()}`;
    const nickname = payload.nickname.trim();
    if (!nickname) {
      return { reason: 'nickname is required' };
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
        avatarUrl: 'https://dummyimage.com/120x120/1f2937/ffffff.png&text=VIP',
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
      const updated = await this.prisma.member.update({
        where: { id: found.id },
        data: {
          ...(payload.nickname ? { nickname: payload.nickname } : {}),
          ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
        },
      });
      return this.toMemberProfile(updated);
    }

    const level = await this.prisma.memberLevel.findFirst({ orderBy: { minPoints: 'asc' } });
    if (!level) {
      throw new Error('member level seed data is missing');
    }

    const user = await this.prisma.member.create({
      data: {
        id: openId,
        openId,
        phone: null,
        nickname: payload.nickname || `微信用户-${payload.code.slice(0, 6)}`,
        remark: null,
        avatarUrl: payload.avatarUrl || 'https://dummyimage.com/120x120/1f2937/ffffff.png&text=WX',
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

  async listAppointments(userId?: string): Promise<Appointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: userId ? { userId } : undefined,
      orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'desc' }],
    });
    return appointments.map((item) => this.toAppointment(item));
  }

  async listBookedAppointmentSlots(
    appointmentDate: string,
    excludeUserId?: string,
  ): Promise<BookedAppointmentSlot[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDate,
        status: APPOINTMENT_STATUS.CONFIRMED,
        ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
      },
      orderBy: { startTime: 'asc' },
    });

    return appointments.map((item) => ({
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

    if (!this.isAllowedAppointmentTime(payload.startTime) || (payload.endTime && !this.isAllowedAppointmentTime(payload.endTime))) {
      return { reason: 'appointment time must be between 09:00 and 21:00' };
    }

    const endTime = payload.endTime || payload.startTime;
    if (endTime !== payload.startTime && this.timeToMinutes(endTime) <= this.timeToMinutes(payload.startTime)) {
      return { reason: 'appointment end time must be later than start time' };
    }

    const occupiedAppointment = await this.prisma.appointment.findFirst({
      where: {
        appointmentDate: payload.appointmentDate,
        startTime: payload.startTime,
        endTime,
        status: APPOINTMENT_STATUS.CONFIRMED,
        NOT: { userId },
      },
    });
    if (occupiedAppointment) {
      return { reason: 'appointment time slot already booked' };
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        id: `ap-${uuid()}`,
        userId,
        memberNickname: member.nickname,
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
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      },
    });

    return { appointment: this.toAppointment(appointment) };
  }

  async createAdminAppointment(
    adminId: string,
    payload: CreateAdminAppointmentRequest,
  ): Promise<{ appointment?: Appointment; reason?: string }> {
    const member = await this.prisma.member.findUnique({ where: { id: payload.userId } });
    if (!member) {
      return { reason: 'member not found' };
    }

    if (!this.isAllowedAppointmentTime(payload.startTime) || (payload.endTime && !this.isAllowedAppointmentTime(payload.endTime))) {
      return { reason: 'appointment time must be between 09:00 and 21:00' };
    }

    const endTime = payload.endTime || payload.startTime;
    if (endTime !== payload.startTime && this.timeToMinutes(endTime) <= this.timeToMinutes(payload.startTime)) {
      return { reason: 'appointment end time must be later than start time' };
    }

    const status = payload.status || APPOINTMENT_STATUS.CONFIRMED;
    const adminRemark = payload.adminRemark?.trim();
    if (status === APPOINTMENT_STATUS.CANCELLED && !adminRemark) {
      return { reason: 'reject reason is required' };
    }

    if (status === APPOINTMENT_STATUS.CONFIRMED) {
      const occupiedAppointment = await this.prisma.appointment.findFirst({
        where: {
          appointmentDate: payload.appointmentDate,
          startTime: payload.startTime,
          endTime,
          status: APPOINTMENT_STATUS.CONFIRMED,
          NOT: { userId: payload.userId },
        },
      });
      if (occupiedAppointment) {
        return { reason: 'appointment time slot already booked' };
      }
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        id: `ap-${uuid()}`,
        userId: payload.userId,
        memberNickname: member.nickname,
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
        appointmentDate: appointment.appointmentDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      },
    });

    return { appointment: this.toAppointment(appointment) };
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
    const nextAppointmentDate = payload.appointmentDate || existing.appointmentDate;
    const nextStartTime = payload.startTime || existing.startTime;
    const nextEndTime = payload.endTime || (payload.startTime ? payload.startTime : existing.endTime);

    if (payload.userId && payload.userId !== existing.userId) {
      const member = await this.prisma.member.findUnique({ where: { id: payload.userId } });
      if (!member) {
        return { reason: 'member not found' };
      }
    }

    if (!this.isAllowedAppointmentTime(nextStartTime) || !this.isAllowedAppointmentTime(nextEndTime)) {
      return { reason: 'appointment time must be between 09:00 and 21:00' };
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

    if (nextStatus === APPOINTMENT_STATUS.CONFIRMED) {
      const occupiedAppointment = await this.prisma.appointment.findFirst({
        where: {
          appointmentDate: nextAppointmentDate,
          startTime: nextStartTime,
          endTime: nextEndTime,
          status: APPOINTMENT_STATUS.CONFIRMED,
          NOT: { id: existing.id },
        },
      });
      if (occupiedAppointment) {
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
        appointmentDate: updated.appointmentDate,
        startTime: updated.startTime,
        endTime: updated.endTime,
        status: updated.status,
        adminRemark: updated.adminRemark,
      },
    });

    return { appointment: this.toAppointment(updated) };
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

      const before = this.memberSnapshot(member);
      let nextLevel: MemberLevel | undefined;
      if (payload.levelId !== undefined) {
        const level = await tx.memberLevel.findUnique({ where: { id: payload.levelId } });
        if (!level) {
          return { reason: 'level not found' };
        }
        nextLevel = this.toMemberLevel(level);
      }

      const nextMemberId = payload.id?.trim() || member.id;
      if (nextMemberId !== member.id) {
        const duplicated = await tx.member.findUnique({ where: { id: nextMemberId } });
        if (duplicated) {
          return { reason: 'member id already exists' };
        }

        await tx.rechargeOrder.updateMany({ where: { userId: member.id }, data: { userId: nextMemberId } });
        await tx.consumptionOrder.updateMany({ where: { userId: member.id }, data: { userId: nextMemberId } });
        await tx.appointment.updateMany({ where: { userId: member.id }, data: { userId: nextMemberId } });
        await tx.balanceLedger.updateMany({ where: { userId: member.id }, data: { userId: nextMemberId } });
      }

      const updated = await tx.member.update({
        where: { id: member.id },
        data: {
          id: nextMemberId,
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
            originMemberId: memberId,
            changes: this.diffSnapshot(before, after),
          },
        },
        tx,
      );

      return { member: this.toMemberProfile(updated) };
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
      };

      const phone = payload.phone?.trim();
      if (phone) {
        const duplicated = await tx.member.findFirst({
          where: {
            OR: [{ id: phone }, { phone }],
            NOT: { id: member.id },
          },
        });
        if (duplicated) {
          return { reason: 'phone already bound by another member' };
        }

        if (phone !== member.id) {
          await tx.rechargeOrder.updateMany({ where: { userId: member.id }, data: { userId: phone } });
          await tx.consumptionOrder.updateMany({ where: { userId: member.id }, data: { userId: phone } });
          await tx.appointment.updateMany({ where: { userId: member.id }, data: { userId: phone } });
          await tx.balanceLedger.updateMany({ where: { userId: member.id }, data: { userId: phone } });
        }
      }

      const updated = await tx.member.update({
        where: { id: member.id },
        data: {
          ...(phone ? { id: phone, phone } : {}),
          ...(payload.birthday !== undefined ? { birthday: payload.birthday } : {}),
        },
      });

      const after = {
        id: updated.id,
        phone: updated.phone || undefined,
        birthday: updated.birthday || undefined,
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

  async listAuditLogs(): Promise<AuditLog[]> {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
    return logs.map((log) => this.toAuditLog(log));
  }

  private async ensureBootstrapData(): Promise<void> {
    const [levelCount, adminCount, productTypeCount] = await Promise.all([
      this.prisma.memberLevel.count(),
      this.prisma.adminUser.count(),
      this.prisma.productType.count(),
    ]);
    const seed = createDefaultStore();

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

  private toAppointment(item: DbAppointment): Appointment {
    return {
      id: item.id,
      userId: item.userId,
      memberNickname: item.memberNickname,
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
      ...member,
      phone: member.phone || null,
      remark: member.remark || null,
      birthday: member.birthday || null,
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
