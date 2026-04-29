import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';

@Module({
  controllers: [AuthController],
  providers: [WechatMiniappService],
})
export class AuthModule {}
