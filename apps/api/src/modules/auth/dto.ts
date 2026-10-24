import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
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

export class MemberPasswordLoginDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,32}$/)
  username!: string;

  @IsString()
  @Length(1, 128)
  password!: string;
}
