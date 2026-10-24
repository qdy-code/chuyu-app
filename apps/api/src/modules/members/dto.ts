import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  BUSINESS_TYPE,
  BindWechatPhoneRequest,
  BusinessType,
  CreateAppointmentRequest,
  UpdateMyProfileRequest,
  CreateMemberMessageRequest,
} from '@member-platform/shared';

export class UpdateMyProfileDto implements UpdateMyProfileRequest {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'phone must be a valid mainland China mobile number' })
  @IsOptional()
  phone?: string;

  @Matches(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'birthday must use MM-DD format' })
  @IsOptional()
  birthday?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @IsOptional()
  nickname?: string;

}

export class BindWechatPhoneDto implements BindWechatPhoneRequest {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'mockPhone must be a valid mainland China mobile number' })
  @IsOptional()
  mockPhone?: string;
}

export class CreateMemberLinkCodeDto {
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;
}

export class ConfirmPhoneRecoveryDto {
  @IsString()
  @Matches(/^\d{8}$/)
  code!: string;

  @IsIn([true])
  confirmed!: true;
}

export class CreateMemberMessageDto implements CreateMemberMessageRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  requestId!: string;
}

export class CreateAppointmentDto implements CreateAppointmentRequest {
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
}
