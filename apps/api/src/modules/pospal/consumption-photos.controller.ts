import { BadRequestException, Controller, Delete, Get, Headers, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ConsumptionPhotosService } from './consumption-photos.service';

@Controller('admin/members/:memberId/consumptions/:orderId/photos')
export class ConsumptionPhotosAdminController {
  constructor(private readonly photos: ConsumptionPhotosService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 9, {
    limits: { fileSize: 8 * 1024 * 1024, files: 9 },
    fileFilter: (_req, file, callback) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype) || /\.(heic|heif)$/i.test(file.originalname);
      callback(allowed ? null : new BadRequestException('请上传 JPG、PNG、WebP 或 HEIC 图片'), allowed);
    },
  }))
  upload(@Param('memberId') memberId: string, @Param('orderId') orderId: string, @Headers('x-admin-id') adminId: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.photos.upload(memberId, orderId, adminId, files);
  }

  @Delete(':photoId')
  remove(@Param('memberId') memberId: string, @Param('orderId') orderId: string, @Param('photoId') photoId: string, @Headers('x-admin-id') adminId: string) {
    return this.photos.remove(memberId, orderId, photoId, adminId);
  }
}

@Controller('uploads/member-consumption')
export class ConsumptionPhotoMediaController {
  constructor(private readonly photos: ConsumptionPhotosService) {}

  @Get(':id')
  async image(@Param('id') id: string, @Query('expires') expires: string, @Query('signature') signature: string, @Res() response: Response) {
    const image = await this.photos.readImage(id, expires, signature);
    response.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    response.send(Buffer.from(image));
  }
}
