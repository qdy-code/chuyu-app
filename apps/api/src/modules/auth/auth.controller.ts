import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { LoginResponse } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';
import { signToken } from '../../common/token';
import { AdminLoginDto, WechatLoginDto } from './dto';

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
      token: signToken(user.id, 'member'),
      user,
    };
  }

  @Post('admin/login')
  async adminLogin(@Body() payload: AdminLoginDto): Promise<{ token: string }> {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      throw new UnauthorizedException('admin login not configured');
    }
    if (payload.password !== password) {
      throw new UnauthorizedException('wrong password');
    }

    const admins = await this.store.getAdmins();
    const admin = admins[0];
    if (!admin) {
      throw new UnauthorizedException('no admin account exists');
    }

    return { token: signToken(admin.id, 'admin') };
  }
}
