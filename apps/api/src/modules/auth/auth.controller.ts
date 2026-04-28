import { Body, Controller, Post } from '@nestjs/common';
import { LoginResponse } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { WechatLoginDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly store: DataStoreService) {}

  @Post('wechat/login')
  login(@Body() payload: WechatLoginDto): LoginResponse {
    const user = this.store.loginByWechat(payload);
    return {
      token: `token-${user.id}`,
      user,
    };
  }
}
