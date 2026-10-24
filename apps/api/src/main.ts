import { ValidationPipe } from '@nestjs/common';
import './config/load-env';
import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync } from 'node:fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getUploadDir } from './config/upload-path';
import { validateProductionEnv } from './config/validate-production-env';
import { AppModule } from './app.module';
import type { NextFunction, Request, Response } from 'express';
import { configureTrustedProxy } from './config/trusted-proxy';

async function bootstrap() {
  validateProductionEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureTrustedProxy(app);
  app.disable('x-powered-by');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true }
      : undefined,
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const uploadDir = getUploadDir();
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
  });

  const port = Number(process.env.API_PORT || 3000);
  const host = process.env.API_HOST || '0.0.0.0';
  await app.listen(port, host);
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
