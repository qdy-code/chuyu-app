import type { Appointment, AppointmentStatus, AuditLog } from '@member-platform/shared';

export const auditActionLabels: Record<string, string> = {
  'seed.init': '系统初始化',
  'auth.wechat.login': '会员微信登录',
  'recharge.apply': '提交充值申请',
  'recharge.approve': '通过充值申请',
  'recharge.reject': '拒绝充值申请',
  'member.recharge': '后台充值',
  'member.create': '新增会员',
  'member.update': '修改会员资料',
  'member.self.update': '会员自助修改资料',
  'member_level.create': '新增会员等级',
  'member_level.update': '修改会员等级',
  'member_level.delete': '删除会员等级',
  'product_type.create': '新增产品类型',
  'product_type.update': '修改产品类型',
  'product_type.delete': '删除产品类型',
  'consumption.create': '创建消费订单',
  'consumption.delete': '删除并冲销消费订单',
  'appointment.create': '会员提交预约',
  'appointment.update': '处理预约',
  'appointment.delete': '删除预约排期',
  'appointment_unavailable_date.create': '设置不可预约日',
  'appointment_unavailable_date.delete': '恢复可预约日',
};

export const auditFieldLabels: Record<string, string> = {
  originMemberId: '原会员 ID',
  openId: 'OpenID',
  userId: '会员 ID',
  phone: '手机号',
  productType: '产品类型',
  originalPrice: '原价',
  discountRate: '折扣率',
  finalPrice: '会员价',
  orderNo: '订单号',
  orderDate: '订单日期',
  title: '订单标题',
  message: '说明',
  comment: '备注',
  reason: '原因',
  balance: '余额',
  points: '积分',
  nickname: '昵称',
  remark: '会员备注',
  birthday: '生日',
  levelId: '等级 ID',
  levelName: '等级名称',
  appointmentDate: '预约日期',
  businessType: '业务范围',
  startTime: '开始时间',
  endTime: '结束时间',
  status: '状态',
  adminRemark: '后台备注',
  id: '会员 ID',
  changes: '变更明细',
};

export function getAuditActionLabel(action: string): string {
  return auditActionLabels[action] || action;
}

export function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value);
}

export function formatAuditMetadata(metadata: AuditLog['metadata']): string[] {
  if (!metadata) return ['无详情'];

  const lines: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'changes' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [field, detail] of Object.entries(value as Record<string, unknown>)) {
        const fieldLabel = auditFieldLabels[field] || field;
        if (detail && typeof detail === 'object' && ('from' in detail || 'to' in detail)) {
          const change = detail as { from?: unknown; to?: unknown };
          lines.push(`${fieldLabel}：${formatAuditValue(change.from)} → ${formatAuditValue(change.to)}`);
        } else {
          lines.push(`${fieldLabel}：${formatAuditValue(detail)}`);
        }
      }
      continue;
    }

    if (value && typeof value === 'object' && ('from' in value || 'to' in value)) {
      const change = value as { from?: unknown; to?: unknown };
      lines.push(`${auditFieldLabels[key] || key}：${formatAuditValue(change.from)} → ${formatAuditValue(change.to)}`);
      continue;
    }

    lines.push(`${auditFieldLabels[key] || key}：${formatAuditValue(value)}`);
  }

  return lines;
}

export function appointmentStatusText(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    PENDING: '待处理',
    CONFIRMED: '已接受',
    CANCELLED: '已拒绝',
    COMPLETED: '已结束',
  };
  return map[status] || status;
}

export function appointmentStatusType(status: AppointmentStatus): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const map: Record<AppointmentStatus, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    PENDING: 'warning',
    CONFIRMED: 'success',
    CANCELLED: 'error',
    COMPLETED: 'default',
  };
  return map[status] || 'default';
}

export function appointmentTimeText(item: Appointment): string {
  return item.endTime && item.endTime !== item.startTime
    ? `${item.startTime}-${item.endTime}`
    : item.startTime;
}

export function appointmentActionText(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    PENDING: '处理',
    CONFIRMED: '接受',
    CANCELLED: '拒绝',
    COMPLETED: '已结束',
  };
  return map[status] || status;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatMoney(value: number | undefined | null): string {
  return Number(value ?? 0).toFixed(2);
}

export function discountPercent(rate: number): string {
  if (rate >= 1) return '无折扣';
  return `${Math.round(rate * 100)}折`;
}
