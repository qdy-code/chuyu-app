import { Module } from '@nestjs/common';
import { MemberPasswordService } from './member-password.service';
import { AuthController } from './auth.controller';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';

@Module({
  controllers: [AuthController],
  providers: [WechatMiniappService, MemberPasswordService],
})
export class AuthModule {}
