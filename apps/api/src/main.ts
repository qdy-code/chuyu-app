import { ValidationPipe } from '@nestjs/common';
import './config/load-env';
import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync } from 'node:fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getUploadDir } from './config/upload-path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

bootstrap();
