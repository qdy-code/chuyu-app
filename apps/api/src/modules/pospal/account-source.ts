import { ServiceUnavailableException } from '@nestjs/common';

export function usesPospalAccounts(): boolean {
  return process.env.POSPAL_ACCOUNT_SOURCE === 'pospal';
}

export function assertLocalAccountingAllowed(): void {
  if (usesPospalAccounts()) {
    throw new ServiceUnavailableException('账务由银豹收银系统管理，请在银豹完成充值、消费、积分调整和冲销');
  }
}
