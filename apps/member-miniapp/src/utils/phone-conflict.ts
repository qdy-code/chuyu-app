import type { MemberPhoneRecovery } from '@member-platform/shared';
export class PhoneConflictError extends Error {
  constructor(public readonly recovery: MemberPhoneRecovery) {
    super('该手机号已有会员，请选择找回或到店核验关联');
  }
}
