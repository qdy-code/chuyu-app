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

export class SetMemberCredentialDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,32}$/, { message: '账号须为 4–32 位英文字母、数字或下划线' })
  username!: string;

  @IsString()
  @Length(12, 128, { message: '密码须为 12–128 位字符' })
  @Matches(/\S/, { message: '密码不能全为空格' })
  password!: string;
}
