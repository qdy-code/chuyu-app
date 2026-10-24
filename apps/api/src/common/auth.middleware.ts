import { ForbiddenException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './token';
import { PrismaService } from '../store/prisma.service';

@Injectable()
export class MemberAuthMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing token');
    }

    const payload = verifyToken(auth.slice(7));
    if (!payload || payload.role !== 'member') throw new UnauthorizedException('invalid or expired token');
    const member = await this.prisma.member.findUnique({ where: { id: payload.sub }, select: { deletedAt: true, authVersion: true } });
    if (!member || member.deletedAt || (payload.version || 0) !== (member.authVersion || 0)) throw new UnauthorizedException('invalid or expired token');

    if (payload.method === 'password') {
      const credential = await this.prisma.memberCredential.findUnique({ where: { memberId: payload.sub }, select: { enabled: true } });
      if (!credential?.enabled) throw new UnauthorizedException('invalid or expired token');
      // Password possession does not prove the WeChat identity of the caller.
      const path = decodeURIComponent(req.originalUrl.split('?')[0]).toLowerCase().replace(/\/+$/, '');
      const identityMutation = req.method !== 'GET' && (
        /\/members\/me\/(phone|phone-recovery\/confirm|link-code)$/.test(path) ||
        (/\/members\/me$/.test(path) && req.body?.phone !== undefined)
      );
      if (identityMutation) throw new ForbiddenException('请使用微信登录后验证或关联手机号');
    }
    req.headers['x-user-id'] = payload.sub;
    next();
  }
}

@Injectable()
export class AdminAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing token');
    }

    const payload = verifyToken(auth.slice(7));
    if (!payload || payload.role !== 'admin') {
      throw new UnauthorizedException('invalid or expired admin token');
    }

    req.headers['x-admin-id'] = payload.sub;
    next();
  }
}
