import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WechatLoginRequest } from '@member-platform/shared';

export class WechatLoginDto implements WechatLoginRequest {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  openIdHint?: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
