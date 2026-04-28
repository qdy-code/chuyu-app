import { IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { RechargeApplyRequest, RejectRechargeRequest } from '@member-platform/shared';

export class RechargeApplyDto implements RechargeApplyRequest {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class RejectRechargeDto implements RejectRechargeRequest {
  @IsString()
  @MinLength(2)
  reason!: string;
}
