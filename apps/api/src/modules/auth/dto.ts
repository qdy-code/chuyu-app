import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WechatLoginRequest } from '@member-platform/shared';

export class WechatLoginDto implements WechatLoginRequest {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  openIdHint?: string;

}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
