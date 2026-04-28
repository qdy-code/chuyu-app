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
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { v4 as uuid } from 'uuid';
import { ConsumptionOrder, MemberLevel, MemberProfile, RechargeOrder } from '@member-platform/shared';
import { getUploadDir } from '../../config/upload-path';
import { DataStoreService } from '../../store/data-store.service';
import {
  CreateConsumptionOrderDto,
  CreateMemberLevelDto,
  RejectRechargeAdminDto,
  UpdateMemberDto,
  UpdateMemberLevelDto,
} from './dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly store: DataStoreService) {}

  @Get('members')
  listMembers(): MemberProfile[] {
    return this.store.listMembers();
  }

  @Get('members/:id')
  detailMember(@Param('id') id: string): MemberProfile {
    const member = this.store.getMemberById(id);
    if (!member) {
      throw new NotFoundException('member not found');
    }
    return member;
  }

  @Patch('members/:id')
  updateMember(@Param('id') id: string, @Body() payload: UpdateMemberDto): MemberProfile {
    const result = this.store.updateMember(id, payload);
    if (!result.member) {
      throw new BadRequestException(result.reason || 'failed to update member');
    }
    return result.member;
  }

  @Get('members/:id/consumptions')
  listMemberConsumption(@Param('id') id: string): ConsumptionOrder[] {
    const member = this.store.getMemberById(id);
    if (!member) {
      throw new NotFoundException('member not found');
    }
    return this.store.listConsumptionOrders(id);
  }

  @Post('member-levels')
  createLevel(@Body() payload: CreateMemberLevelDto): MemberLevel {
    return this.store.createLevel(payload);
  }

  @Patch('member-levels/:id')
  updateLevel(@Param('id') id: string, @Body() payload: UpdateMemberLevelDto): MemberLevel {
    const level = this.store.updateLevel(id, payload);
    if (!level) {
      throw new NotFoundException('level not found');
    }
    return level;
  }

  @Get('member-levels')
  listLevels(): MemberLevel[] {
    return this.store.listLevels();
  }

  @Get('recharges')
  listRecharges(): RechargeOrder[] {
    return this.store.listRechargeOrders();
  }

  @Post('recharges/:id/approve')
  approve(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
  ): RechargeOrder {
    const effectiveAdminId = adminId || this.store.getAdmins()[0]?.id || 'admin-unknown';
    const order = this.store.approveRecharge(id, effectiveAdminId);
    if (!order) {
      throw new NotFoundException('order not found or already finalized');
    }
    return order;
  }

  @Post('recharges/:id/reject')
  reject(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
    @Body() payload: RejectRechargeAdminDto,
  ): RechargeOrder {
    const effectiveAdminId = adminId || this.store.getAdmins()[0]?.id || 'admin-unknown';
    const order = this.store.rejectRecharge(id, effectiveAdminId, payload);
    if (!order) {
      throw new NotFoundException('order not found or already finalized');
    }
    return order;
  }

  @Post('uploads/images')
  @UseInterceptors(
    FilesInterceptor('files', 9, {
      storage: diskStorage({
        destination: getUploadDir(),
        filename: (_req, file, callback) => {
          callback(null, `${Date.now()}-${uuid()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        callback(null, file.mimetype.startsWith('image/'));
      },
    }),
  )
  uploadImages(@UploadedFiles() files: Express.Multer.File[]): { urls: string[] } {
    if (!files || files.length === 0) {
      throw new BadRequestException('no image uploaded');
    }

    return {
      urls: files.map((file) => `/uploads/${file.filename}`),
    };
  }

  @Post('orders')
  createOrder(
    @Headers('x-admin-id') adminId: string | undefined,
    @Body() payload: CreateConsumptionOrderDto,
  ): ConsumptionOrder {
    const effectiveAdminId = adminId || this.store.getAdmins()[0]?.id || 'admin-unknown';
    const result = this.store.createConsumptionOrder(effectiveAdminId, payload);

    if (!result.order) {
      throw new BadRequestException(result.reason || 'failed to create order');
    }

    return result.order;
  }

  @Get('orders')
  listOrders(@Query('userId') userId?: string): ConsumptionOrder[] {
    if (userId) {
      return this.store.listConsumptionOrders(userId);
    }
    return this.store.listConsumptionOrders();
  }
}
