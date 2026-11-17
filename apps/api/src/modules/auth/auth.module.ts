import { Module } from '@nestjs/common';
import { MemberPasswordService } from './member-password.service';
import { AuthController } from './auth.controller';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';
import { MemberCredentialAdminController } from './member-credential-admin.controller';

@Module({
  controllers: [AuthController, MemberCredentialAdminController],
  providers: [WechatMiniappService, MemberPasswordService],
})
export class AuthModule {}
