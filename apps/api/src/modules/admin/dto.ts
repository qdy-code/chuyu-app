import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  APPOINTMENT_STATUS,
  AppointmentStatus,
  CreateAdminAppointmentRequest,
  CreateConsumptionOrderRequest,
  CreateMemberRequest,
  CreateMemberLevelRequest,
  CreateProductTypeRequest,
  RejectRechargeRequest,
  UpdateAppointmentRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
  UpdateProductTypeRequest,
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

export class CreateMemberDto implements CreateMemberRequest {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  nickname!: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  phone?: string;

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

export class CreateProductTypeDto implements CreateProductTypeRequest {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateProductTypeDto implements UpdateProductTypeRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class CreateAdminAppointmentDto implements CreateAdminAppointmentRequest {
  @IsString()
  userId!: string;

  @IsDateString()
  appointmentDate!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must use HH:mm format' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must use HH:mm format' })
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsIn(Object.values(APPOINTMENT_STATUS))
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  adminRemark?: string;
}

export class UpdateAppointmentDto implements UpdateAppointmentRequest {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsDateString()
  @IsOptional()
  appointmentDate?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must use HH:mm format' })
  @IsOptional()
  startTime?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must use HH:mm format' })
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsIn(Object.values(APPOINTMENT_STATUS))
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  adminRemark?: string;
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

  @IsString()
  @IsOptional()
  remark?: string;

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
