import type { MemberProfile, RechargeOrder } from '@member-platform/shared';

export function memberNumber(profile: MemberProfile | null | undefined): string {
  if (!profile) return '—';
  if (profile.pospal?.state === 'UNLINKED') return '待关联';
  return profile.pospal ? profile.pospal.customerNumber || '暂不可用' : profile.id;
}

export function rechargeStatusText(order: RechargeOrder): string {
  if (order.source === 'POSPAL' && order.status === 'APPROVED') return '已入账';
  return { PENDING: '审核中', APPROVED: '已通过', REJECTED: '已拒绝' }[order.status];
}
