import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Patch, Post, Query } from '@nestjs/common';
import { Appointment, BookedAppointmentSlot, MemberProfile } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';
import { BindWechatPhoneDto, CreateAppointmentDto, UpdateMyProfileDto } from './dto';

@Controller('members')
export class MembersController {
  constructor(
    private readonly store: DataStoreService,
    private readonly wechatMiniapp: WechatMiniappService,
  ) {}

  @Get('me')
  async getMe(@Headers('x-user-id') userId?: string): Promise<MemberProfile> {
    const fallbackUser = userId ? undefined : (await this.store.listMembers())[0];
    const member = (userId && (await this.store.getMemberById(userId))) || fallbackUser;
    if (!member) {
      throw new NotFoundException('member not found');
    }
    return member;
  }

  @Patch('me')
  async updateMe(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: UpdateMyProfileDto,
  ): Promise<MemberProfile> {
    const members = userId ? [] : await this.store.listMembers();
    const effectiveUserId = userId || members[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }

    const result = await this.store.updateMemberSelf(effectiveUserId, payload);
    if (!result.member) {
      if (result.reason === 'member not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to update member');
    }
    return result.member;
  }

  @Patch('me/phone')
  async bindWechatPhone(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: BindWechatPhoneDto,
  ): Promise<MemberProfile> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }

    const phone = await this.wechatMiniapp.resolvePhoneNumber(payload.code, payload.mockPhone);
    const result = await this.store.updateMemberSelf(userId, { phone });
    if (!result.member) {
      if (result.reason === 'member not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to bind phone');
    }
    return result.member;
  }

  @Get('me/appointments')
  async listMyAppointments(@Headers('x-user-id') userId: string | undefined): Promise<Appointment[]> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    return this.store.listAppointments(userId);
  }

  @Get('appointments/booked-slots')
  async listBookedAppointmentSlots(
    @Headers('x-user-id') userId: string | undefined,
    @Query('date') date?: string,
  ): Promise<BookedAppointmentSlot[]> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    if (!date) {
      throw new BadRequestException('date is required');
    }

    return this.store.listBookedAppointmentSlots(date, userId);
  }

  @Post('me/appointments')
  async createAppointment(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: CreateAppointmentDto,
  ): Promise<Appointment> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }

    const result = await this.store.createAppointment(userId, payload);
    if (!result.appointment) {
      if (result.reason === 'member not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to create appointment');
    }
    return result.appointment;
  }
}
