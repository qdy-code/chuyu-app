import { IsDateString, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { BindWechatPhoneRequest, CreateAppointmentRequest, UpdateMyProfileRequest } from '@member-platform/shared';

export class UpdateMyProfileDto implements UpdateMyProfileRequest {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'phone must be a valid mainland China mobile number' })
  @IsOptional()
  phone?: string;

  @IsDateString()
  @IsOptional()
  birthday?: string;
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

export class CreateAppointmentDto implements CreateAppointmentRequest {
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
}
