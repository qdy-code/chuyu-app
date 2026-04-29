import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { Appointment, ConsumptionOrder, MemberLevel, MemberProfile, ProductType, RechargeOrder } from '@member-platform/shared';
import { getUploadDir } from '../../config/upload-path';
import { DataStoreService } from '../../store/data-store.service';
import {
  CreateAdminAppointmentDto,
  CreateConsumptionOrderDto,
  CreateMemberDto,
  CreateMemberLevelDto,
  CreateProductTypeDto,
  RejectRechargeAdminDto,
  UpdateAppointmentDto,
  UpdateMemberDto,
  UpdateMemberLevelDto,
  UpdateProductTypeDto,
} from './dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly store: DataStoreService) {}

  @Get('members')
  listMembers(): Promise<MemberProfile[]> {
    return this.store.listMembers();
  }

  @Post('members')
  async createMember(@Body() payload: CreateMemberDto): Promise<MemberProfile> {
    const result = await this.store.createMember(payload);
    if (!result.member) {
      throw new BadRequestException(result.reason || 'failed to create member');
    }
    return result.member;
  }

  @Get('members/:id')
  async detailMember(@Param('id') id: string): Promise<MemberProfile> {
    const member = await this.store.getMemberById(id);
    if (!member) {
      throw new NotFoundException('member not found');
    }
    return member;
  }

  @Patch('members/:id')
  async updateMember(@Param('id') id: string, @Body() payload: UpdateMemberDto): Promise<MemberProfile> {
    const result = await this.store.updateMember(id, payload);
    if (!result.member) {
      throw new BadRequestException(result.reason || 'failed to update member');
    }
    return result.member;
  }

  @Get('members/:id/consumptions')
  async listMemberConsumption(@Param('id') id: string): Promise<ConsumptionOrder[]> {
    const member = await this.store.getMemberById(id);
    if (!member) {
      throw new NotFoundException('member not found');
    }
    return this.store.listConsumptionOrders(id);
  }

  @Post('member-levels')
  createLevel(@Body() payload: CreateMemberLevelDto): Promise<MemberLevel> {
    return this.store.createLevel(payload);
  }

  @Patch('member-levels/:id')
  async updateLevel(@Param('id') id: string, @Body() payload: UpdateMemberLevelDto): Promise<MemberLevel> {
    const level = await this.store.updateLevel(id, payload);
    if (!level) {
      throw new NotFoundException('level not found');
    }
    return level;
  }

  @Delete('member-levels/:id')
  async deleteLevel(@Param('id') id: string): Promise<{ success: true }> {
    const result = await this.store.deleteLevel(id);
    if (!result.success) {
      if (result.reason === 'level not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to delete level');
    }
    return { success: true };
  }

  @Get('member-levels')
  listLevels(): Promise<MemberLevel[]> {
    return this.store.listLevels();
  }

  @Get('product-types')
  listProductTypes(): Promise<ProductType[]> {
    return this.store.listProductTypes();
  }

  @Post('product-types')
  async createProductType(@Body() payload: CreateProductTypeDto): Promise<ProductType> {
    const result = await this.store.createProductType(payload);
    if (!result.productType) {
      throw new BadRequestException(result.reason || 'failed to create product type');
    }
    return result.productType;
  }

  @Patch('product-types/:id')
  async updateProductType(@Param('id') id: string, @Body() payload: UpdateProductTypeDto): Promise<ProductType> {
    const result = await this.store.updateProductType(id, payload);
    if (!result.productType) {
      throw new BadRequestException(result.reason || 'failed to update product type');
    }
    return result.productType;
  }

  @Delete('product-types/:id')
  async deleteProductType(@Param('id') id: string): Promise<{ success: true }> {
    const result = await this.store.deleteProductType(id);
    if (!result.success) {
      throw new BadRequestException(result.reason || 'failed to delete product type');
    }
    return { success: true };
  }

  @Get('appointments')
  listAppointments(): Promise<Appointment[]> {
    return this.store.listAppointments();
  }

  @Post('appointments')
  async createAppointment(
    @Headers('x-admin-id') adminId: string | undefined,
    @Body() payload: CreateAdminAppointmentDto,
  ): Promise<Appointment> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.createAdminAppointment(effectiveAdminId, payload);
    if (!result.appointment) {
      throw new BadRequestException(result.reason || 'failed to create appointment');
    }
    return result.appointment;
  }

  @Patch('appointments/:id')
  async updateAppointment(@Param('id') id: string, @Body() payload: UpdateAppointmentDto): Promise<Appointment> {
    const result = await this.store.updateAppointment(id, payload);
    if (!result.appointment) {
      throw new BadRequestException(result.reason || 'failed to update appointment');
    }
    return result.appointment;
  }

  @Get('recharges')
  listRecharges(): Promise<RechargeOrder[]> {
    return this.store.listRechargeOrders();
  }

  @Post('recharges/:id/approve')
  async approve(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
  ): Promise<RechargeOrder> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const order = await this.store.approveRecharge(id, effectiveAdminId);
    if (!order) {
      throw new NotFoundException('order not found or already finalized');
    }
    return order;
  }

  @Post('recharges/:id/reject')
  async reject(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
    @Body() payload: RejectRechargeAdminDto,
  ): Promise<RechargeOrder> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const order = await this.store.rejectRecharge(id, effectiveAdminId, payload);
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
  async createOrder(
    @Headers('x-admin-id') adminId: string | undefined,
    @Body() payload: CreateConsumptionOrderDto,
  ): Promise<ConsumptionOrder> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.createConsumptionOrder(effectiveAdminId, payload);

    if (!result.order) {
      throw new BadRequestException(result.reason || 'failed to create order');
    }

    return result.order;
  }

  @Get('orders')
  listOrders(@Query('userId') userId?: string): Promise<ConsumptionOrder[]> {
    if (userId) {
      return this.store.listConsumptionOrders(userId);
    }
    return this.store.listConsumptionOrders();
  }
}
