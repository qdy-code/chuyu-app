import { Controller, Get } from '@nestjs/common';
import { AuditLog } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';

@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly store: DataStoreService) {}

  @Get()
  async listAuditLogs(): Promise<AuditLog[]> {
    return this.store.listAuditLogs();
  }
}
