import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { join } from 'node:path';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import {
  Appointment,
  AppointmentUnavailableDate,
  BookedAppointmentSlot,
  BUSINESS_TYPE,
  BusinessType,
  CatalogProduct,
  MemberProfile,
  ProductCategory,
} from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { WechatMiniappService } from '../wechat/wechat-miniapp.service';
import { BindWechatPhoneDto, CreateAppointmentDto, CreateMemberLinkCodeDto, CreateMemberMessageDto, UpdateMyProfileDto } from './dto';
import { getUploadDir } from '../../config/upload-path';
import { PospalService } from '../pospal/pospal.service';
import { usesPospalAccounts } from '../pospal/account-source';

@Controller('members')
export class MembersController {
  constructor(
    private readonly store: DataStoreService,
    private readonly wechatMiniapp: WechatMiniappService,
    private readonly pospal: PospalService,
  ) {}

  @Get('me')
  async getMe(@Headers('x-user-id') userId?: string): Promise<MemberProfile> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    return this.pospal.accountProfile(userId);
  }

  @Get('me/cached-profile')
  async getCachedMe(@Headers('x-user-id') userId?: string): Promise<MemberProfile> {
    if (!userId) throw new NotFoundException('member not found');
    return this.pospal.cachedAccountProfile(userId);
  }

  @Patch('me')
  async updateMe(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: UpdateMyProfileDto,
  ): Promise<MemberProfile> {
    return this.updateMyProfile(userId, payload);
  }

  @Put('me')
  async replaceMe(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: UpdateMyProfileDto,
  ): Promise<MemberProfile> {
    return this.updateMyProfile(userId, payload);
  }

  private async updateMyProfile(
    userId: string | undefined,
    payload: UpdateMyProfileDto,
  ): Promise<MemberProfile> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }

    const result = await this.store.updateMemberSelf(userId, payload);
    if (!result.member) {
      if (result.reason === 'member not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to update member');
    }
    return this.pospal.cachedAccountProfile(userId);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        callback(allowed ? null : new Error('unsupported avatar image type'), allowed);
      },
    }),
  )
  async uploadAvatar(
    @Headers('x-user-id') userId: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MemberProfile> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    if (!file?.buffer) {
      throw new BadRequestException('no avatar uploaded');
    }

    const filename = `avatar-${uuid()}.jpg`;
    try {
      await sharp(file.buffer)
        .rotate()
        .resize(512, 512, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 88 })
        .toFile(join(getUploadDir(), filename));
    } catch {
      throw new BadRequestException('avatar image format is not supported');
    }

    const result = await this.store.updateMemberAvatar(userId, `/uploads/${filename}`);
    if (!result.member) {
      throw new BadRequestException(result.reason || 'failed to update avatar');
    }
    return this.pospal.cachedAccountProfile(userId);
  }

  @Post('me/link-code')
  createLinkCode(@Headers('x-user-id') userId: string, @Body() payload: CreateMemberLinkCodeDto) {
    return this.store.createMemberLinkCode(userId, payload.phone);
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
    const result = await this.store.updateMemberSelf(userId, { phone }, process.env.MINIAPP_LOGIN_MODE !== 'mock');
    if (!result.member) {
      if (result.reason === 'member not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to bind phone');
    }
    return this.pospal.cachedAccountProfile(userId);
  }

  // uni.request on WeChat supports PUT; retain PATCH for existing clients.
  @Put('me/phone')
  bindWechatPhoneWithPut(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: BindWechatPhoneDto,
  ): Promise<MemberProfile> {
    return this.bindWechatPhone(userId, payload);
  }

  @Get('me/appointments')
  async listMyAppointments(@Headers('x-user-id') userId: string | undefined): Promise<Appointment[]> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    return this.store.listAppointments(userId);
  }

  @Get('me/messages')
  async listMyMessages(@Headers('x-user-id') userId: string | undefined) {
    if (!userId) throw new NotFoundException('member not found');
    return this.store.listMemberMessages(userId);
  }

  @Get('me/points-ledger')
  async listMyPointsLedger(@Headers('x-user-id') userId: string | undefined) {
    if (!userId) throw new NotFoundException('member not found');
    if (usesPospalAccounts()) return [];
    return this.store.listPointsLedger(userId);
  }

  @Post('me/messages')
  async createMessage(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: CreateMemberMessageDto,
  ) {
    if (!userId) throw new NotFoundException('member not found');
    return this.store.createMemberMessage(userId, payload);
  }

  @Get('catalog/:business/categories')
  async listCatalogCategories(@Param('business') business: string): Promise<ProductCategory[]> {
    return this.store.listProductCategories(this.parseBusinessType(business));
  }

  @Get('catalog/:business/products')
  async listCatalogProducts(
    @Headers('x-user-id') userId: string | undefined,
    @Param('business') business: string,
    @Query('categoryId') categoryId?: string,
  ): Promise<CatalogProduct[]> {
    return this.store.listCatalogProducts(this.parseBusinessType(business), { userId, categoryId });
  }

  @Get('appointments/booked-slots')
  async listBookedAppointmentSlots(
    @Headers('x-user-id') userId: string | undefined,
    @Query('date') date?: string,
    @Query('businessType') businessType?: string,
  ): Promise<BookedAppointmentSlot[]> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    if (!date) {
      throw new BadRequestException('date is required');
    }

    return this.store.listBookedAppointmentSlots(date, userId, this.parseBusinessType((businessType as string) || BUSINESS_TYPE.NAIL));
  }

  @Get('appointments/unavailable-dates')
  listAppointmentUnavailableDates(
    @Query('businessType') businessType?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ): Promise<AppointmentUnavailableDate[]> {
    return this.store.listAppointmentUnavailableDates({
      businessType: this.parseBusinessType((businessType as string) || BUSINESS_TYPE.NAIL),
      fromDate,
      toDate,
    });
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

  private parseBusinessType(value: string): BusinessType {
    const normalized = value.toUpperCase();
    if (!Object.values(BUSINESS_TYPE).includes(normalized as BusinessType)) {
      throw new BadRequestException('invalid business type');
    }
    return normalized as BusinessType;
  }
}
