import { PospalMemberSyncService } from './pospal-member-sync.service';
import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { LinkPospalMemberDto } from './dto';
import { PospalClientService } from './pospal-client.service';
import { PospalService } from './pospal.service';

@Controller('admin/pospal')
export class PospalController {
  constructor(private readonly client: PospalClientService, private readonly pospal: PospalService, private readonly sync: PospalMemberSyncService) {}

  @Get('member-sync')
  listSync() { return this.sync.list(); }

  @Post('member-sync/:id/retry')
  retrySync(@Param('id') id: string, @Headers('x-admin-id') adminId: string) { return this.sync.retry(id, adminId); }

  @Get('status')
  status() {
    return this.client.getConfiguration();
  }

  @Post('connection-test')
  checkConnection() {
    return this.client.checkConnection();
  }

  @Post('members/:id/preview')
  previewMember(@Param('id') memberId: string) {
    return this.pospal.previewMember(memberId);
  }

  @Post('members/:id/link')
  linkMember(@Param('id') memberId: string, @Headers('x-admin-id') adminId: string, @Body() payload: LinkPospalMemberDto) {
    return this.pospal.linkMember(memberId, payload.customerUid, adminId, payload.identityVerified);
  }
}
