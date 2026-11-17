import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import type { ConsumptionOrder } from '@member-platform/shared';
import { PrismaService } from '../../store/prisma.service';
import { PospalClientService } from './pospal-client.service';

const convertHeic = require('heic-convert') as (options: { buffer: Buffer; format: 'JPEG'; quality: number }) => Promise<Buffer>;
type Scope = { account: string; customerUid: string };
const localScope: Scope = { account: '', customerUid: '' };
const PHOTO_LIMIT = 9;
const ACCESS_SECONDS = 3600;

@Injectable()
export class ConsumptionPhotosService {
  constructor(private readonly prisma: PrismaService, private readonly client: PospalClientService) {}

  private signature(id: string, memberId: string, version: number, expires: number) {
    return createHmac('sha256', process.env.JWT_SECRET || 'dev-secret-change-in-production')
      .update(`consumption-photo:v1:${id}:${memberId}:${version}:${expires}`).digest('base64url');
  }

  private imageUrl(id: string, memberId: string, version: number) {
    const expires = Math.floor(Date.now() / 1000) + ACCESS_SECONDS;
    return `/uploads/member-consumption/${id}?expires=${expires}&signature=${this.signature(id, memberId, version, expires)}`;
  }

  async decorate(memberId: string, orders: ConsumptionOrder[], scope: Scope = localScope): Promise<ConsumptionOrder[]> {
    if (!orders.length) return orders;
    const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { authVersion: true, deletedAt: true } });
    if (!member || member.deletedAt) throw new NotFoundException('会员不存在');
    const photos = await this.prisma.consumptionPhoto.findMany({
      where: { memberId, ...scope, orderId: { in: orders.map(order => order.id) }, removedAt: null },
      select: { id: true, orderId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return orders.map(order => {
      const consumptionPhotos = photos.filter(photo => photo.orderId === order.id)
        .map(photo => ({ id: photo.id, url: this.imageUrl(photo.id, memberId, member.authVersion) }));
      return { ...order, effectImages: [...order.effectImages, ...consumptionPhotos.map(photo => photo.url)], consumptionPhotos };
    });
  }

  private async orderScope(memberId: string, orderId: string): Promise<{ scope: Scope; legacyCount: number }> {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member || member.deletedAt) throw new NotFoundException('会员不存在');
    if (this.client.getConfiguration().accountSource === 'pospal') {
      const link = await this.prisma.pospalMemberLink.findUnique({ where: { memberId } });
      if (!link || link.account !== this.client.getAccount()) throw new BadRequestException('请先核对银豹会员关联');
      const orders = await this.client.getConsumptions(link.customerUid, memberId);
      if (!orders.some(order => order.id === orderId && order.userId === memberId)) throw new NotFoundException('该会员的消费记录不存在或已超出最近 100 条，请刷新后重试');
      return { scope: { account: link.account, customerUid: link.customerUid }, legacyCount: 0 };
    }
    const order = await this.prisma.consumptionOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== memberId) throw new NotFoundException('该会员的消费记录不存在');
    return { scope: localScope, legacyCount: order.effectImages.length };
  }

  async upload(memberId: string, orderId: string, adminId: string, files: Express.Multer.File[]) {
    if (!files?.length || files.length > PHOTO_LIMIT || files.reduce((total, file) => total + file.size, 0) > 18 * 1024 * 1024) {
      throw new BadRequestException('请选择 1–9 张图片，每次上传总大小不超过 18MB');
    }
    const { scope, legacyCount } = await this.orderScope(memberId, orderId);
    const images: Buffer[] = [];
    for (const file of files) {
      try {
        const source = /\.(heic|heif)$/i.test(file.originalname) || ['image/heic', 'image/heif'].includes(file.mimetype)
          ? await convertHeic({ buffer: file.buffer, format: 'JPEG', quality: 0.9 }) : file.buffer;
        images.push(await sharp(source, { limitInputPixels: 50_000_000 }).rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer());
      } catch { throw new BadRequestException('图片格式不支持或文件已损坏，请使用 JPG、PNG、WebP 或 HEIC'); }
    }
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member || member.deletedAt) throw new NotFoundException('会员不存在');
      if (scope.account) {
        const link = await tx.pospalMemberLink.findUnique({ where: { memberId } });
        if (!link || link.account !== scope.account || link.customerUid !== scope.customerUid || this.client.getAccount() !== scope.account || this.client.getConfiguration().accountSource !== 'pospal') throw new BadRequestException('会员关联已变更，请刷新后重试');
      } else {
        const order = await tx.consumptionOrder.findUnique({ where: { id: orderId } });
        if (this.client.getConfiguration().accountSource === 'pospal' || !order || order.userId !== memberId || order.effectImages.length !== legacyCount) throw new BadRequestException('消费记录已变更，请刷新后重试');
      }
      const count = await tx.consumptionPhoto.count({ where: { memberId, orderId, ...scope, removedAt: null } });
      if (legacyCount + count + images.length > PHOTO_LIMIT) throw new BadRequestException('每笔消费最多保存 9 张图片');
      for (const image of images) await tx.consumptionPhoto.create({ data: { id: randomUUID(), memberId, orderId, ...scope, image: new Uint8Array(image) } });
      await tx.auditLog.create({ data: { id: `a-${randomUUID()}`, actorId: adminId, actorRole: 'ADMIN', action: 'consumption.photos.upload', targetType: 'member', targetId: memberId, metadata: { orderId, count: images.length }, createdAt: new Date() } });
    });
    return { success: true };
  }

  async remove(memberId: string, orderId: string, photoId: string, adminId: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1297043278, 1)`;
      const photo = await tx.consumptionPhoto.findFirst({ where: { id: photoId, memberId, orderId, removedAt: null } });
      if (!photo) throw new NotFoundException('图片不存在');
      await tx.consumptionPhoto.update({ where: { id: photoId }, data: { removedAt: new Date() } });
      await tx.auditLog.create({ data: { id: `a-${randomUUID()}`, actorId: adminId, actorRole: 'ADMIN', action: 'consumption.photos.remove', targetType: 'member', targetId: memberId, metadata: { orderId, photoId }, createdAt: new Date() } });
      return { success: true };
    });
  }

  async readImage(id: string, expiresValue: string, signature: string) {
    const expires = Number(expiresValue);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(expires) || expires <= now || expires > now + ACCESS_SECONDS || !/^[A-Za-z0-9_-]{43}$/.test(signature || '')) throw new NotFoundException('图片链接已失效，请刷新消费记录');
    const photo = await this.prisma.consumptionPhoto.findUnique({ where: { id }, include: { member: { select: { deletedAt: true, authVersion: true } } } });
    if (!photo || photo.removedAt || photo.member.deletedAt) throw new NotFoundException('图片不存在');
    const expected = this.signature(id, photo.memberId, photo.member.authVersion, expires);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new NotFoundException('图片链接已失效，请刷新消费记录');
    if (photo.account) {
      const link = await this.prisma.pospalMemberLink.findUnique({ where: { memberId: photo.memberId } });
      if (this.client.getConfiguration().accountSource !== 'pospal' || !link || link.account !== photo.account || link.customerUid !== photo.customerUid || this.client.getAccount() !== photo.account) throw new NotFoundException('图片关联已变更');
    } else {
      const order = await this.prisma.consumptionOrder.findUnique({ where: { id: photo.orderId } });
      if (this.client.getConfiguration().accountSource === 'pospal' || !order || order.userId !== photo.memberId) throw new NotFoundException('消费记录不存在');
    }
    return photo.image;
  }
}
