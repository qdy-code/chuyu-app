import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Patch } from '@nestjs/common';
import { MemberProfile } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { UpdateMyProfileDto } from './dto';

@Controller('members')
export class MembersController {
  constructor(private readonly store: DataStoreService) {}

  @Get('me')
  getMe(@Headers('x-user-id') userId?: string): MemberProfile {
    const fallbackUser = this.store.listMembers()[0];
    const member = (userId && this.store.getMemberById(userId)) || fallbackUser;
    if (!member) {
      throw new NotFoundException('member not found');
    }
    return member;
  }

  @Patch('me')
  updateMe(@Headers('x-user-id') userId: string | undefined, @Body() payload: UpdateMyProfileDto): MemberProfile {
    const effectiveUserId = userId || this.store.listMembers()[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }

    const result = this.store.updateMemberSelf(effectiveUserId, payload);
    if (!result.member) {
      if (result.reason === 'member not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to update member');
    }
    return result.member;
  }
}
