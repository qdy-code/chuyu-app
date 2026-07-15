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
import { readFile, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import {
  Appointment,
  AppointmentUnavailableDate,
  BUSINESS_TYPE,
  BusinessType,
  CatalogProduct,
  ConsumptionOrder,
  MemberLevel,
  MemberProfile,
  ProductCategory,
  ProductType,
  RechargeOrder,
  RevenueOverview,
} from '@member-platform/shared';
import { getUploadDir } from '../../config/upload-path';
import { DataStoreService } from '../../store/data-store.service';
import {
  AdminRechargeDto,
  CreateAdminAppointmentDto,
  CreateAppointmentUnavailableDateDto,
  CreateCatalogProductDto,
  CreateConsumptionOrderDto,
  CreateMemberDto,
  CreateMemberLevelDto,
  CreateProductCategoryDto,
  CreateProductTypeDto,
  RejectRechargeAdminDto,
  UpdateAppointmentDto,
  UpdateCatalogProductDto,
  UpdateMemberDto,
  UpdateMemberLevelDto,
  UpdateProductCategoryDto,
  UpdateProductTypeDto,
} from './dto';

const convertHeic = require('heic-convert') as (options: {
  buffer: Buffer;
  format: 'JPEG';
  quality: number;
}) => Promise<Buffer>;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

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

  @Delete('members/:id')
  async deleteMember(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.deleteMember(id, effectiveAdminId);
    if (!result.success) {
      if (result.reason === 'member not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to delete member');
    }
    return { success: true };
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

  @Get('catalog/:business/categories')
  listCatalogCategories(@Param('business') business: string): Promise<ProductCategory[]> {
    return this.store.listProductCategories(this.parseBusinessType(business));
  }

  @Post('catalog/:business/categories')
  async createCatalogCategory(
    @Param('business') business: string,
    @Body() payload: CreateProductCategoryDto,
  ): Promise<ProductCategory> {
    const result = await this.store.createProductCategory(this.parseBusinessType(business), payload);
    if (!result.category) {
      throw new BadRequestException(result.reason || 'failed to create category');
    }
    return result.category;
  }

  @Patch('catalog/:business/categories/:id')
  async updateCatalogCategory(
    @Param('business') business: string,
    @Param('id') id: string,
    @Body() payload: UpdateProductCategoryDto,
  ): Promise<ProductCategory> {
    const result = await this.store.updateProductCategory(this.parseBusinessType(business), id, payload);
    if (!result.category) {
      throw new BadRequestException(result.reason || 'failed to update category');
    }
    return result.category;
  }

  @Delete('catalog/:business/categories/:id')
  async deleteCatalogCategory(@Param('business') business: string, @Param('id') id: string): Promise<{ success: true }> {
    const result = await this.store.deleteProductCategory(this.parseBusinessType(business), id);
    if (!result.success) {
      throw new BadRequestException(result.reason || 'failed to delete category');
    }
    return { success: true };
  }

  @Get('catalog/:business/products')
  listCatalogProducts(@Param('business') business: string): Promise<CatalogProduct[]> {
    return this.store.listCatalogProducts(this.parseBusinessType(business), { includeInactive: true });
  }

  @Post('catalog/:business/products')
  async createCatalogProduct(
    @Param('business') business: string,
    @Body() payload: CreateCatalogProductDto,
  ): Promise<CatalogProduct> {
    const result = await this.store.createCatalogProduct(this.parseBusinessType(business), payload);
    if (!result.product) {
      throw new BadRequestException(result.reason || 'failed to create product');
    }
    return result.product;
  }

  @Patch('catalog/:business/products/:id')
  async updateCatalogProduct(
    @Param('business') business: string,
    @Param('id') id: string,
    @Body() payload: UpdateCatalogProductDto,
  ): Promise<CatalogProduct> {
    const result = await this.store.updateCatalogProduct(this.parseBusinessType(business), id, payload);
    if (!result.product) {
      throw new BadRequestException(result.reason || 'failed to update product');
    }
    return result.product;
  }

  @Delete('catalog/:business/products/:id')
  async deleteCatalogProduct(@Param('business') business: string, @Param('id') id: string): Promise<{ success: true }> {
    const result = await this.store.deleteCatalogProduct(this.parseBusinessType(business), id);
    if (!result.success) {
      throw new BadRequestException(result.reason || 'failed to delete product');
    }
    return { success: true };
  }

  @Get('appointments')
  listAppointments(): Promise<Appointment[]> {
    return this.store.listAppointments();
  }

  @Get('appointment-unavailable-dates')
  listAppointmentUnavailableDates(
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ): Promise<AppointmentUnavailableDate[]> {
    return this.store.listAppointmentUnavailableDates({ fromDate, toDate });
  }

  @Post('appointment-unavailable-dates')
  async createAppointmentUnavailableDate(
    @Headers('x-admin-id') adminId: string | undefined,
    @Body() payload: CreateAppointmentUnavailableDateDto,
  ): Promise<AppointmentUnavailableDate> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.createAppointmentUnavailableDate(effectiveAdminId, payload);
    if (!result.unavailableDate) {
      throw new BadRequestException(result.reason || 'failed to create appointment unavailable date');
    }
    return result.unavailableDate;
  }

  @Delete('appointment-unavailable-dates/:id')
  async deleteAppointmentUnavailableDate(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.deleteAppointmentUnavailableDate(id, effectiveAdminId);
    if (!result.success) {
      if (result.reason === 'appointment unavailable date not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to delete appointment unavailable date');
    }
    return { success: true };
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

  @Delete('appointments/:id')
  async deleteAppointment(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.deleteAppointment(id, effectiveAdminId);
    if (!result.success) {
      if (result.reason === 'appointment not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to delete appointment');
    }
    return { success: true };
  }

  @Get('recharges')
  listRecharges(): Promise<RechargeOrder[]> {
    return this.store.listRechargeOrders();
  }

  @Post('recharges')
  async createRecharge(
    @Headers('x-admin-id') adminId: string | undefined,
    @Body() payload: AdminRechargeDto,
  ): Promise<MemberProfile> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.createAdminRecharge(effectiveAdminId, payload);
    if (!result.member) {
      throw new BadRequestException(result.reason || 'failed to recharge member');
    }
    return result.member;
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
      limits: { fileSize: 8 * 1024 * 1024, files: 9 },
      storage: diskStorage({
        destination: getUploadDir(),
        filename: (_req, file, callback) => {
          callback(null, `${Date.now()}-${uuid()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        const allowed = ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) || ['.heic', '.heif'].includes(extension);
        callback(allowed ? null : new Error('unsupported image type'), allowed);
      },
    }),
  )
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]): Promise<{ urls: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('no image uploaded');
    }

    const urls = await Promise.all(
      files.map(async (file) => {
        const extension = extname(file.filename).toLowerCase();
        const jpegFilename = `${file.filename.slice(0, Math.max(0, file.filename.length - extension.length))}-${uuid()}.jpg`;
        const jpegPath = join(getUploadDir(), jpegFilename);
        try {
          const source = await readFile(file.path);
          const imageBuffer = ['.heic', '.heif'].includes(extension) || ['image/heic', 'image/heif'].includes(file.mimetype)
            ? await convertHeic({ buffer: source, format: 'JPEG', quality: 0.9 })
            : source;
          await sharp(imageBuffer)
            .rotate()
            .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 88 })
            .toFile(jpegPath);
          await unlink(file.path);
          return `/uploads/${jpegFilename}`;
        } catch {
          await unlink(file.path).catch(() => undefined);
          await unlink(jpegPath).catch(() => undefined);
          throw new BadRequestException('图片格式不支持或文件已损坏，请改用 JPG、PNG、WebP 或 HEIC');
        }
      }),
    );

    return {
      urls,
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

  @Delete('orders/:id')
  async deleteOrder(
    @Headers('x-admin-id') adminId: string | undefined,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const admins = adminId ? [] : await this.store.getAdmins();
    const effectiveAdminId = adminId || admins[0]?.id || 'admin-unknown';
    const result = await this.store.deleteConsumptionOrder(id, effectiveAdminId);
    if (!result.success) {
      if (result.reason === 'consumption order not found') {
        throw new NotFoundException(result.reason);
      }
      throw new BadRequestException(result.reason || 'failed to delete consumption order');
    }
    return { success: true };
  }

  @Get('revenue')
  getRevenue(@Query('month') month?: string): Promise<RevenueOverview> {
    if (month && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('invalid revenue month');
    }
    return this.store.getRevenueOverview(month);
  }

  private parseBusinessType(value: string): BusinessType {
    const normalized = value.toUpperCase();
    if (!Object.values(BUSINESS_TYPE).includes(normalized as BusinessType)) {
      throw new BadRequestException('invalid business type');
    }
    return normalized as BusinessType;
  }
}
