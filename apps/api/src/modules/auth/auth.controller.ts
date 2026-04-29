import { Body, Controller, Post } from '@nestjs/common';
import { LoginResponse } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';
import { WechatLoginDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly store: DataStoreService,
    private readonly wechatMiniapp: WechatMiniappService,
  ) {}

  @Post('wechat/login')
  async login(@Body() payload: WechatLoginDto): Promise<LoginResponse> {
    const openId = await this.wechatMiniapp.resolveOpenId(payload.code, payload.openIdHint);
    const user = await this.store.loginByWechat({
      ...payload,
      openIdHint: openId,
    });
    return {
      token: `token-${user.id}`,
      user,
    };
  }
}
