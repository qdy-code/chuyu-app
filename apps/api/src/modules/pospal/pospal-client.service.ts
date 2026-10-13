import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { ConsumptionOrder, RechargeOrder, PospalConfiguration, PospalConnectionCheck, PospalMemberCandidate } from '@member-platform/shared';

const BASE_URL = 'https://platform.pospal.cn';
const CONFIG_KEYS = ['POSPAL_APP_ID', 'POSPAL_APP_KEY', 'POSPAL_ACCOUNT'] as const;
type PospalPage = { list: Record<string, unknown>[]; hasMore: boolean; requestId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  throw new BadGatewayException('银豹返回的标识字段无效或超过安全精度');
}

function amount(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value))) {
    throw new BadGatewayException('银豹返回的余额或积分格式无效');
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER / 100) {
    throw new BadGatewayException('银豹返回的余额或积分超出支持范围');
  }
  return parsed;
}

function businessDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new BadGatewayException('银豹记录时间格式无效');
  const date = new Date(`${value.replace(' ', 'T')}+08:00`);
  if (!Number.isFinite(date.getTime())) throw new BadGatewayException('银豹记录时间无效');
  return date.toISOString();
}

@Injectable()
export class PospalClientService {
  private readonly activeQueries = new Map<string, Promise<PospalPage>>();
  getConfiguration(): PospalConfiguration {
    const missingEnv = CONFIG_KEYS.filter((key) => !process.env[key]?.trim());
    return {
      enabled: process.env.POSPAL_ENABLED === 'true',
      configured: missingEnv.length === 0,
      missingEnv,
      readOnly: true,
      accountSource: process.env.POSPAL_ACCOUNT_SOURCE === 'pospal' ? 'pospal' : 'local',
    };
  }

  getAccount(): string {
    const account = process.env.POSPAL_ACCOUNT?.trim();
    if (!account) throw new ServiceUnavailableException('银豹目标账号未配置');
    return account;
  }

  async getRecharges(uid: string, memberId: string): Promise<RechargeOrder[]> {
    identifier(uid);
    const response = await this.queryPage('/openapi/v3/customer/recharge-log/page', { customerUid: uid, limit: 100, order: 'desc' });
    return response.list.map((row) => {
      if (identifier(row.customerUid) !== uid) throw new BadGatewayException('银豹充值记录会员范围不一致');
      const createdAt = businessDate(row.datetime);
      return { id: `pospal-${identifier(row.id)}`, userId: memberId, amount: amount(row.rechargeMoney),
        giftAmount: amount(row.giftMoney ?? 0), status: 'APPROVED', createdAt, updatedAt: createdAt, source: 'POSPAL' };
    });
  }

  async getConsumptions(uid: string, memberId: string): Promise<ConsumptionOrder[]> {
    identifier(uid);
    const response = await this.queryPage('/openapi/v3/ticket/increment-page', {
      customerUid: uid, limit: 100, order: 'desc', reversed: 0, needTicketItems: true,
    });
    return response.list.map((row) => {
      if (identifier(row.customerUid) !== uid) throw new BadGatewayException('银豹消费记录会员范围不一致');
      if (typeof row.sn !== 'string' || !row.sn) throw new BadGatewayException('银豹销售单号无效');
      const createdAt = businessDate(row.datetime);
      const total = amount(row.totalAmount);
      const refund = row.refund === 1;
      const items = Array.isArray(row.ticketItems) ? row.ticketItems.filter(isRecord) : [];
      const names = items.map((item) => typeof item.name === 'string' ? item.name : '').filter(Boolean);
      const title = (refund ? '退货 / 退款 · ' : '') + (names.slice(0, 3).join('、') || '门店消费');
      return { id: `pospal-${identifier(row.uid)}`, orderNo: row.sn, userId: memberId, title,
        productType: refund ? '退货 / 退款' : '门店消费', originalPrice: total,
        finalPrice: refund ? -Math.abs(total) : total, discountRate: 1, effectImages: [],
        orderDate: String(row.datetime).slice(0, 10), createdBy: 'pospal', createdAt, source: 'POSPAL' };
    });
  }

  async getMemberByUid(uid: string): Promise<PospalMemberCandidate & { phone: string; discountRate: number; levelName: string }> {
    identifier(uid);
    const response = await this.queryPage('/openapi/v3/customer/increment-page', { uid, limit: 2, needCustomerCategory: true });
    const row = response.list[0];
    if (!row || response.list.length !== 1 || response.hasMore || identifier(row.uid) !== uid) {
      throw new BadGatewayException('银豹会员不存在或返回结果不唯一');
    }
    if (row.enable !== 1 || row.isLoss === 1 || row.active === -10) {
      throw new BadGatewayException('银豹会员已停用、删除或挂失，请联系门店处理');
    }
    const discount = amount(row.discount ?? 100);
    if (discount < 0 || discount > 100) throw new BadGatewayException('银豹会员折扣格式无效');
    const category = isRecord(row.customerCategory) ? row.customerCategory : null;
    return { ...this.memberCandidate(row), phone: typeof row.tel === 'string' ? row.tel.trim() : '',
      discountRate: discount / 100, levelName: typeof category?.name === 'string' ? category.name : '会员' };
  }

  private memberCandidate(row: Record<string, unknown>): PospalMemberCandidate {
    if (typeof row.number !== 'string' || !row.number || typeof row.name !== 'string') {
      throw new BadGatewayException('银豹会员资料格式无效');
    }
    return {
      uid: identifier(row.uid), number: row.number, name: row.name,
      balance: amount(row.money), giftBalance: amount(row.giftMoney ?? 0), points: amount(row.point),
    };
  }

  async checkConnection(): Promise<PospalConnectionCheck> {
    const response = await this.queryPage('/openapi/v3/user/page', { limit: 1 });
    return {
      requestId: response.requestId,
      checkedAt: new Date().toISOString(),
      stores: response.list.map((row) => ({
        userId: identifier(row.userId),
        company: typeof row.company === 'string' ? row.company : '',
        self: row.self === true,
      })),
      hasMore: response.hasMore,
    };
  }

  async findMembersByPhone(phone: string): Promise<{
    candidates: PospalMemberCandidate[]; hasMore: boolean; requestId: string;
  }> {
    if (!/^\d{6,32}$/.test(phone)) {
      throw new ServiceUnavailableException('会员手机号格式不支持银豹查询，请先核对资料');
    }
    // 不把手机号当作唯一身份：取两条并保留 hasMore，供管理员核对重复会员。
    const response = await this.queryPage('/openapi/v3/customer/increment-page', { tel: phone, limit: 2 });
    return {
      requestId: response.requestId,
      hasMore: response.hasMore,
      candidates: response.list.map((row) => this.memberCandidate(row)),
    };
  }

  private async queryPage(path: string, filters: Record<string, unknown>): Promise<PospalPage> {
    const configuration = this.getConfiguration();
    if (!configuration.enabled || !configuration.configured) {
      throw new ServiceUnavailableException('银豹连接未启用或服务端凭证未配置');
    }
    const key = JSON.stringify([process.env.POSPAL_APP_ID?.trim(), this.getAccount(), path, filters]);
    let task = this.activeQueries.get(key);
    if (!task) {
      task = this.executeQueryPage(path, filters);
      this.activeQueries.set(key, task);
    }
    try {
      return await task;
    } finally {
      if (this.activeQueries.get(key) === task) this.activeQueries.delete(key);
    }
  }

  private async executeQueryPage(path: string, filters: Record<string, unknown>): Promise<PospalPage> {
    const configuration = this.getConfiguration();
    if (!configuration.enabled || !configuration.configured) {
      throw new ServiceUnavailableException('银豹连接未启用或服务端凭证未配置');
    }
    const appId = process.env.POSPAL_APP_ID!.trim();
    const appKey = process.env.POSPAL_APP_KEY!.trim();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const requestId = randomUUID();
    const sign = createHash('md5').update(`${appId}|${requestId}|${timestamp}|${appKey}`).digest('hex').toUpperCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // 固定官方域名、禁止重定向、不自动重试，避免转发凭证或重复消耗 Token。
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'X-App-Id': appId,
          'X-Timestamp': timestamp,
          'X-Request-Id': requestId,
          'X-Sign': sign,
        },
        body: JSON.stringify({ lastId: 0, order: 'asc', ...filters, account: process.env.POSPAL_ACCOUNT!.trim() }),
      });
      if (!response.ok) throw new BadGatewayException(`银豹 HTTP ${response.status}，请求编号 ${requestId}`);
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new BadGatewayException(`银豹返回非 JSON 响应，请求编号 ${requestId}`);
      }
      if (!isRecord(data)) throw new BadGatewayException('银豹响应格式无效');
      if (data.status !== 'success' || data.errorCode !== 0) {
        const code = typeof data.errorCode === 'number' && Number.isSafeInteger(data.errorCode) ? data.errorCode : 'unknown';
        const message = code === 4021 ? '银豹 Token 余额不足或正式服务已暂停' : `银豹业务请求失败（${code}）`;
        // 不转发上游 messages，防止上游错误回显密钥、签名或会员资料。
        throw new BadGatewayException(`${message}，请求编号 ${requestId}`);
      }
      const result = data.result;
      if (!isRecord(result) || !Array.isArray(result.list) || !result.list.every(isRecord) || typeof result.hasMore !== 'boolean') {
        throw new BadGatewayException('银豹分页结果格式无效');
      }
      return { list: result.list, hasMore: result.hasMore, requestId };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(`银豹连接失败或超时，请求编号 ${requestId}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
