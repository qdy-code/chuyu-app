import { Body, Controller, HttpException, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { LoginResponse } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';
import { signToken } from '../../common/token';
import { AdminLoginDto, WechatLoginDto } from './dto';

const ADMIN_LOGIN_LIMIT = 5;
const ADMIN_LOGIN_BLOCK_MS = 15 * 60 * 1000;
const adminLoginAttempts = new Map<string, { count: number; blockedUntil: number }>();

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
      code: payload.code,
      openIdHint: openId,
    });
    return {
      token: signToken(user.id, 'member'),
      user,
    };
  }

  @Post('admin/login')
  async adminLogin(@Req() request: Request, @Body() payload: AdminLoginDto): Promise<{ token: string }> {
    const clientKey = request.ip || request.socket.remoteAddress || 'unknown';
    const attempt = adminLoginAttempts.get(clientKey);
    if (attempt && attempt.blockedUntil > Date.now()) {
      throw new HttpException('too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      throw new UnauthorizedException('admin login not configured');
    }
    if (!this.passwordMatches(payload.password, password)) {
      const count = (attempt?.blockedUntil && attempt.blockedUntil <= Date.now() ? 0 : attempt?.count || 0) + 1;
      adminLoginAttempts.set(clientKey, {
        count,
        blockedUntil: count >= ADMIN_LOGIN_LIMIT ? Date.now() + ADMIN_LOGIN_BLOCK_MS : 0,
      });
      throw new UnauthorizedException('wrong password');
    }

    adminLoginAttempts.delete(clientKey);

    const admins = await this.store.getAdmins();
    const admin = admins[0];
    if (!admin) {
      throw new UnauthorizedException('no admin account exists');
    }

    return { token: signToken(admin.id, 'admin') };
  }

  private passwordMatches(candidate: string, expected: string): boolean {
    const candidateDigest = createHash('sha256').update(candidate).digest();
    const expectedDigest = createHash('sha256').update(expected).digest();
    return timingSafeEqual(candidateDigest, expectedDigest);
  }
}
