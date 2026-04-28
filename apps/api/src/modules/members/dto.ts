import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';
import { UpdateMyProfileRequest } from '@member-platform/shared';

export class UpdateMyProfileDto implements UpdateMyProfileRequest {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'phone must be a valid mainland China mobile number' })
  @IsOptional()
  phone?: string;

  @IsDateString()
  @IsOptional()
  birthday?: string;
}
