import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  IsBoolean,
  IsNotEmpty,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import {
  APPOINTMENT_STATUS,
  AdminRechargeRequest,
  AppointmentAvailabilityScope,
  AppointmentStatus,
  BUSINESS_TYPE,
  BusinessType,
  CreateAdminAppointmentRequest,
  CreateAppointmentUnavailableDateRequest,
  CreateCatalogProductRequest,
  CreateConsumptionOrderRequest,
  CreateMemberRequest,
  CreateMemberLevelRequest,
  CreateProductCategoryRequest,
  CreateProductTypeRequest,
  RejectRechargeRequest,
  UpdateAppointmentRequest,
  UpdateCatalogProductRequest,
  UpdateMemberRequest,
  UpdateMemberLevelRequest,
  UpdateProductCategoryRequest,
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
  @IsNotEmpty()
  @MaxLength(30)
  nickname!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  remark?: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'phone must be a valid mainland China mobile number' })
  @IsOptional()
  phone?: string;

  @Matches(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'birthday must use MM-DD format' })
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

export class CreateProductCategoryDto implements CreateProductCategoryRequest {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateProductCategoryDto implements UpdateProductCategoryRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class CreateCatalogProductDto implements CreateCatalogProductRequest {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  referencePrice?: number;

  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCatalogProductDto implements UpdateCatalogProductRequest {
  @IsString()
  @IsOptional()
  categoryId?: string | null;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  referencePrice?: number | null;

  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateAdminAppointmentDto implements CreateAdminAppointmentRequest {
  @IsString()
  userId!: string;

  @IsIn(Object.values(BUSINESS_TYPE))
  @IsOptional()
  businessType?: BusinessType;

  @IsString()
  @IsOptional()
  productId?: string;

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
  @MaxLength(500)
  @IsOptional()
  remark?: string;

  @IsIn(Object.values(APPOINTMENT_STATUS))
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  adminRemark?: string;
}

export class CreateAppointmentUnavailableDateDto implements CreateAppointmentUnavailableDateRequest {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'appointmentDate must use YYYY-MM-DD format',
  })
  appointmentDate!: string;

  @IsIn(['ALL', ...Object.values(BUSINESS_TYPE)])
  businessType!: AppointmentAvailabilityScope;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  reason?: string;
}

export class UpdateAppointmentDto implements UpdateAppointmentRequest {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsIn(Object.values(BUSINESS_TYPE))
  @IsOptional()
  businessType?: BusinessType;

  @IsString()
  @IsOptional()
  productId?: string | null;

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
  @MaxLength(500)
  @IsOptional()
  remark?: string;

  @IsIn(Object.values(APPOINTMENT_STATUS))
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  adminRemark?: string;
}

export class RejectRechargeAdminDto implements RejectRechargeRequest {
  @IsString()
  reason!: string;
}

export class AdminRechargeDto implements AdminRechargeRequest {
  @IsString()
  userId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number;

  @IsString()
  @IsOptional()
  remark?: string;
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
  @IsNotEmpty()
  @MaxLength(30)
  @IsOptional()
  nickname?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  remark?: string;

  @Matches(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'birthday must use MM-DD format' })
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
