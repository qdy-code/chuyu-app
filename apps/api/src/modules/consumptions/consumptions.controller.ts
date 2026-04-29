import { Controller, Get, Headers, NotFoundException } from '@nestjs/common';
import { ConsumptionOrder } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';

@Controller('consumptions')
export class ConsumptionsController {
  constructor(private readonly store: DataStoreService) {}

  @Get('my')
  async myOrders(@Headers('x-user-id') userId: string | undefined): Promise<ConsumptionOrder[]> {
    const members = userId ? [] : await this.store.listMembers();
    const effectiveUserId = userId || members[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }
    return this.store.listConsumptionOrders(effectiveUserId);
  }
}
