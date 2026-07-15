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
import { BindWechatPhoneDto, CreateAppointmentDto, UpdateMyProfileDto } from './dto';
import { getUploadDir } from '../../config/upload-path';

@Controller('members')
export class MembersController {
  constructor(
    private readonly store: DataStoreService,
    private readonly wechatMiniapp: WechatMiniappService,
  ) {}

  @Get('me')
  async getMe(@Headers('x-user-id') userId?: string): Promise<MemberProfile> {
    const member = userId ? await this.store.getMemberById(userId) : undefined;
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
    return result.member;
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
