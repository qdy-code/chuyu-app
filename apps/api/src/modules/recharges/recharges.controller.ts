import { Controller, Get, Headers, NotFoundException } from '@nestjs/common';
import { RechargeOrder } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';

@Controller('recharges')
export class RechargesController {
  constructor(private readonly store: DataStoreService) {}

  @Get('my')
  async myOrders(@Headers('x-user-id') userId: string | undefined): Promise<RechargeOrder[]> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    return this.store.listRechargeOrders(userId);
  }
}
