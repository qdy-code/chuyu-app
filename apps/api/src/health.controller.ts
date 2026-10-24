import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './store/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): { ok: true; service: string } {
    return { ok: true, service: 'moonisle-api' };
  }

  @Get('ready')
  async ready(): Promise<{ ok: true; database: 'ready' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: 'ready' };
    } catch {
      throw new ServiceUnavailableException('database is not ready');
    }
  }
}
