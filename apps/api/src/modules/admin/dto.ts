import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  CreateConsumptionOrderRequest,
  CreateMemberLevelRequest,
  RejectRechargeRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
} from '@member-platform/shared';

export class CreateMemberLevelDto implements CreateMemberLevelRequest {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPoints!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1)
  discountRate!: number;
}

export class UpdateMemberLevelDto implements UpdateMemberLevelRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPoints?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1)
  @IsOptional()
  discountRate?: number;
}

export class RejectRechargeAdminDto implements RejectRechargeRequest {
  @IsString()
  reason!: string;
}

export class CreateConsumptionOrderDto implements CreateConsumptionOrderRequest {
  @IsString()
  userId!: string;

  @IsString()
  @IsOptional()
  productType?: string;

  @IsString()
  title!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  originalPrice!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1)
  @IsOptional()
  discountRate?: number;

  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @IsOptional()
  effectImages?: string[];

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateMemberDto implements UpdateMemberRequest {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsDateString()
  @IsOptional()
  birthday?: string;

  @IsString()
  @IsOptional()
  levelId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1)
  @IsOptional()
  discountRate?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  balance?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number;
}
