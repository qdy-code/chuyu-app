import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './token';

@Injectable()
export class MemberAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing token');
    }

    const payload = verifyToken(auth.slice(7));
    if (!payload) {
      throw new UnauthorizedException('invalid or expired token');
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
