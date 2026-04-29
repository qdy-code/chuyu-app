import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';

@Module({
  controllers: [MembersController],
  providers: [WechatMiniappService],
})
export class MembersModule {}
