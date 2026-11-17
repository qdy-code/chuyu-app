import { Body, Controller, Delete, Get, Header, Headers, Param, Put } from '@nestjs/common';
import { SetMemberCredentialDto } from './dto';
import { MemberPasswordService } from './member-password.service';

@Controller('admin/members/:id/credential')
export class MemberCredentialAdminController {
  constructor(private readonly passwords: MemberPasswordService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  getStatus(@Param('id') id: string) {
    return this.passwords.getStatus(id);
  }

  @Put()
  setCredential(@Param('id') id: string, @Headers('x-admin-id') adminId: string, @Body() dto: SetMemberCredentialDto) {
    return this.passwords.setCredential(id, adminId, dto.username.toLowerCase(), dto.password);
  }

  @Delete()
  disableCredential(@Param('id') id: string, @Headers('x-admin-id') adminId: string) {
    return this.passwords.disableCredential(id, adminId);
  }
}
