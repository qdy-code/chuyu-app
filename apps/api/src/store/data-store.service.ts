import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  AuditLog,
  ConsumptionOrder,
  CreateConsumptionOrderRequest,
  CreateMemberLevelRequest,
  MemberLevel,
  MemberProfile,
  RechargeApplyRequest,
  RechargeOrder,
  RECHARGE_STATUS,
  RejectRechargeRequest,
  UpdateMyProfileRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
  WechatLoginRequest,
} from '@member-platform/shared';
import { AdminUser, createDefaultStore, DataStore, isFinalStatus } from './types';

@Injectable()
export class DataStoreService {
  private readonly store: DataStore = createDefaultStore();

  resetWithSeed(): DataStore {
    const seed = createDefaultStore();
    this.store.users = seed.users;
    this.store.memberLevels = seed.memberLevels;
    this.store.rechargeOrders = seed.rechargeOrders;
    this.store.consumptionOrders = seed.consumptionOrders;
    this.store.balanceLedgers = seed.balanceLedgers;
    this.store.auditLogs = seed.auditLogs;
    this.store.admins = seed.admins;
    return this.store;
  }

  getAdmins(): AdminUser[] {
    return this.store.admins;
  }

  getMemberById(id: string): MemberProfile | undefined {
    return this.store.users.find((user) => user.id === id);
  }

  getMemberByOpenId(openId: string): MemberProfile | undefined {
    return this.store.users.find((user) => user.openId === openId);
  }

  listMembers(): MemberProfile[] {
    return [...this.store.users];
  }

  loginByWechat(payload: WechatLoginRequest): MemberProfile {
    const openId = payload.openIdHint?.trim() || `wx-${payload.code}`;
    const found = this.getMemberByOpenId(openId);
    if (found) {
      if (payload.nickname) found.nickname = payload.nickname;
      if (payload.avatarUrl) found.avatarUrl = payload.avatarUrl;
      return found;
    }

    const level = this.store.memberLevels[0];
    const user: MemberProfile = {
      id: openId,
      openId,
      phone: undefined,
      nickname: payload.nickname || `微信用户-${payload.code.slice(0, 6)}`,
      avatarUrl: payload.avatarUrl || 'https://dummyimage.com/120x120/1f2937/ffffff.png&text=WX',
      birthday: undefined,
      levelId: level.id,
      levelName: level.name,
      discountRate: level.discountRate,
      balance: 0,
      points: 0,
    };

    this.store.users.unshift(user);
    this.writeAudit({
      actorId: user.id,
      actorRole: 'MEMBER',
      action: 'auth.wechat.login',
      targetType: 'user',
      targetId: user.id,
      metadata: { openId },
    });
    return user;
  }

  listRechargeOrders(userId?: string): RechargeOrder[] {
    if (!userId) {
      return [...this.store.rechargeOrders];
    }
    return this.store.rechargeOrders.filter((order) => order.userId === userId);
  }

  getRechargeById(orderId: string): RechargeOrder | undefined {
    return this.store.rechargeOrders.find((order) => order.id === orderId);
  }

  applyRecharge(userId: string, payload: RechargeApplyRequest): RechargeOrder {
    const nextRechargeId = this.createDailyCode(
      'R',
      new Date().toISOString().slice(0, 10),
      this.store.rechargeOrders.map((item) => item.id),
    );

    const order: RechargeOrder = {
      id: nextRechargeId,
      userId,
      amount: payload.amount,
      status: RECHARGE_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.rechargeOrders.unshift(order);
    this.writeAudit({
      actorId: userId,
      actorRole: 'MEMBER',
      action: 'recharge.apply',
      targetType: 'recharge_order',
      targetId: order.id,
      metadata: payload.remark ? { remark: payload.remark } : undefined,
    });
    return order;
  }

  approveRecharge(orderId: string, adminId: string, comment?: string): RechargeOrder | undefined {
    const order = this.getRechargeById(orderId);
    if (!order || isFinalStatus(order.status)) {
      return undefined;
    }

    const user = this.getMemberById(order.userId);
    if (!user) {
      return undefined;
    }

    const beforeBalance = user.balance;
    const beforePoints = user.points;

    order.status = RECHARGE_STATUS.APPROVED;
    order.updatedAt = new Date().toISOString();
    user.balance += order.amount;
    user.points += Math.floor(order.amount);

    this.store.balanceLedgers.unshift({
      id: `bl-${uuid()}`,
      userId: user.id,
      changeAmount: order.amount,
      type: 'RECHARGE_APPROVED',
      relatedOrderId: order.id,
      createdAt: new Date().toISOString(),
    });

    const matchedLevel = this.getMatchedLevel(user.points);
    if (matchedLevel) {
      user.levelId = matchedLevel.id;
      user.levelName = matchedLevel.name;
      user.discountRate = matchedLevel.discountRate;
    }

    this.writeAudit({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'recharge.approve',
      targetType: 'recharge_order',
      targetId: order.id,
      metadata: {
        ...(comment ? { comment } : {}),
        userId: user.id,
        balance: { from: beforeBalance, to: user.balance },
        points: { from: beforePoints, to: user.points },
      },
    });

    return order;
  }

  rejectRecharge(
    orderId: string,
    adminId: string,
    payload: RejectRechargeRequest,
  ): RechargeOrder | undefined {
    const order = this.getRechargeById(orderId);
    if (!order || isFinalStatus(order.status)) {
      return undefined;
    }

    order.status = RECHARGE_STATUS.REJECTED;
    order.rejectReason = payload.reason;
    order.updatedAt = new Date().toISOString();

    this.writeAudit({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'recharge.reject',
      targetType: 'recharge_order',
      targetId: order.id,
      metadata: { reason: payload.reason },
    });

    return order;
  }

  listConsumptionOrders(userId?: string): ConsumptionOrder[] {
    if (!userId) {
      return [...this.store.consumptionOrders];
    }
    return this.store.consumptionOrders.filter((order) => order.userId === userId);
  }

  createConsumptionOrder(
    adminId: string,
    payload: CreateConsumptionOrderRequest,
  ): { order?: ConsumptionOrder; reason?: string } {
    const user = this.getMemberById(payload.userId);
    if (!user) {
      return { reason: 'member not found' };
    }

    const discountRate = payload.discountRate ?? user.discountRate ?? this.getDiscountRateByLevel(user.levelId) ?? 1;
    const finalPrice = this.round2(payload.originalPrice * discountRate);

    if (user.balance < finalPrice) {
      return { reason: 'insufficient balance' };
    }

    const order: ConsumptionOrder = {
      id: `c-${uuid()}`,
      orderNo: this.createDailyCode(
        'CO',
        payload.orderDate || new Date().toISOString().slice(0, 10),
        this.store.consumptionOrders.map((item) => item.orderNo),
      ),
      userId: payload.userId,
      productType: payload.productType,
      title: payload.title,
      originalPrice: this.round2(payload.originalPrice),
      finalPrice,
      discountRate,
      effectImages: payload.effectImages || [],
      orderDate: payload.orderDate || new Date().toISOString().slice(0, 10),
      remark: payload.remark,
      createdBy: adminId,
      createdAt: new Date().toISOString(),
    };

    const beforeBalance = user.balance;
    user.balance = this.round2(user.balance - order.finalPrice);
    this.store.consumptionOrders.unshift(order);

    this.store.balanceLedgers.unshift({
      id: `bl-${uuid()}`,
      userId: user.id,
      changeAmount: -order.finalPrice,
      type: 'CONSUME_ORDER_CREATED',
      relatedOrderId: order.id,
      createdAt: new Date().toISOString(),
    });

    this.writeAudit({
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
        balance: { from: beforeBalance, to: user.balance },
      },
    });

    return { order };
  }

  listLevels(): MemberLevel[] {
    return [...this.store.memberLevels].sort((a, b) => a.minPoints - b.minPoints);
  }

  createLevel(payload: CreateMemberLevelRequest): MemberLevel {
    const level: MemberLevel = {
      id: `level-${uuid()}`,
      name: payload.name,
      minPoints: payload.minPoints,
      discountRate: payload.discountRate,
    };
    this.store.memberLevels.push(level);
    return level;
  }

  updateLevel(levelId: string, payload: UpdateMemberLevelRequest): MemberLevel | undefined {
    const level = this.store.memberLevels.find((item) => item.id === levelId);
    if (!level) {
      return undefined;
    }

    if (payload.name !== undefined) level.name = payload.name;
    if (payload.minPoints !== undefined) level.minPoints = payload.minPoints;
    if (payload.discountRate !== undefined) level.discountRate = payload.discountRate;

    return level;
  }

  updateMember(memberId: string, payload: UpdateMemberRequest): { member?: MemberProfile; reason?: string } {
    const member = this.getMemberById(memberId);
    if (!member) {
      return { reason: 'member not found' };
    }

    const before = {
      id: member.id,
      nickname: member.nickname,
      birthday: member.birthday,
      levelId: member.levelId,
      levelName: member.levelName,
      discountRate: member.discountRate,
      balance: member.balance,
      points: member.points,
    };

    if (payload.id && payload.id !== memberId) {
      const duplicated = this.getMemberById(payload.id);
      if (duplicated) {
        return { reason: 'member id already exists' };
      }

      this.store.rechargeOrders.forEach((order) => {
        if (order.userId === memberId) order.userId = payload.id!;
      });
      this.store.consumptionOrders.forEach((order) => {
        if (order.userId === memberId) order.userId = payload.id!;
      });
      this.store.balanceLedgers.forEach((ledger) => {
        if (ledger.userId === memberId) ledger.userId = payload.id!;
      });
      member.id = payload.id;
    }

    if (payload.nickname !== undefined) member.nickname = payload.nickname;
    if (payload.birthday !== undefined) member.birthday = payload.birthday;
    if (payload.points !== undefined) member.points = this.round2(payload.points);
    if (payload.balance !== undefined) member.balance = this.round2(payload.balance);

    if (payload.levelId !== undefined) {
      const level = this.store.memberLevels.find((item) => item.id === payload.levelId);
      if (!level) {
        return { reason: 'level not found' };
      }
      member.levelId = level.id;
      member.levelName = level.name;
      if (payload.discountRate === undefined) {
        member.discountRate = level.discountRate;
      }
    }

    if (payload.discountRate !== undefined) {
      member.discountRate = payload.discountRate;
    }

    const after = {
      id: member.id,
      nickname: member.nickname,
      birthday: member.birthday,
      levelId: member.levelId,
      levelName: member.levelName,
      discountRate: member.discountRate,
      balance: member.balance,
      points: member.points,
    };

    const changes = Object.fromEntries(
      Object.entries(after)
        .filter(([key, value]) => !Object.is(before[key as keyof typeof before], value))
        .map(([key, value]) => [key, { from: before[key as keyof typeof before], to: value }]),
    );

    this.writeAudit({
      actorId: 'admin-001',
      actorRole: 'ADMIN',
      action: 'member.update',
      targetType: 'member',
      targetId: member.id,
      metadata: {
        originMemberId: memberId,
        changes,
      },
    });

    return { member };
  }

  updateMemberSelf(
    memberId: string,
    payload: UpdateMyProfileRequest,
  ): { member?: MemberProfile; reason?: string } {
    const member = this.getMemberById(memberId);
    if (!member) {
      return { reason: 'member not found' };
    }

    const before = {
      id: member.id,
      phone: member.phone,
      birthday: member.birthday,
    };

    if (payload.phone !== undefined) {
      const phone = payload.phone.trim();
      const duplicated = this.getMemberById(phone);
      if (duplicated && duplicated.id !== member.id) {
        return { reason: 'phone already bound by another member' };
      }
      if (phone !== member.id) {
        this.store.rechargeOrders.forEach((order) => {
          if (order.userId === member.id) order.userId = phone;
        });
        this.store.consumptionOrders.forEach((order) => {
          if (order.userId === member.id) order.userId = phone;
        });
        this.store.balanceLedgers.forEach((ledger) => {
          if (ledger.userId === member.id) ledger.userId = phone;
        });
        member.id = phone;
      }
      member.phone = phone;
    }

    if (payload.birthday !== undefined) {
      member.birthday = payload.birthday;
    }

    const after = {
      id: member.id,
      phone: member.phone,
      birthday: member.birthday,
    };

    const changes = Object.fromEntries(
      Object.entries(after)
        .filter(([key, value]) => !Object.is(before[key as keyof typeof before], value))
        .map(([key, value]) => [key, { from: before[key as keyof typeof before], to: value }]),
    );

    this.writeAudit({
      actorId: member.id,
      actorRole: 'MEMBER',
      action: 'member.self.update',
      targetType: 'member',
      targetId: member.id,
      metadata: {
        originMemberId: memberId,
        changes,
      },
    });

    return { member };
  }

  listAuditLogs(): AuditLog[] {
    return [...this.store.auditLogs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  private getMatchedLevel(points: number): MemberLevel | undefined {
    return [...this.store.memberLevels]
      .sort((a, b) => b.minPoints - a.minPoints)
      .find((level) => points >= level.minPoints);
  }

  private getDiscountRateByLevel(levelId: string): number | undefined {
    return this.store.memberLevels.find((item) => item.id === levelId)?.discountRate;
  }

  private createDailyCode(prefix: string, dateString: string, existingCodes: string[]): string {
    const compact = dateString.replace(/-/g, '');
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

  private writeAudit(entry: Omit<AuditLog, 'id' | 'createdAt'>): void {
    this.store.auditLogs.unshift({
      id: `log-${uuid()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    });
  }
}
