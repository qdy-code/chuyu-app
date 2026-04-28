import { Controller, Get, Headers, NotFoundException } from '@nestjs/common';
import { ConsumptionOrder } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';

@Controller('consumptions')
export class ConsumptionsController {
  constructor(private readonly store: DataStoreService) {}

  @Get('my')
  myOrders(@Headers('x-user-id') userId: string | undefined): ConsumptionOrder[] {
    const effectiveUserId = userId || this.store.listMembers()[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }
    return this.store.listConsumptionOrders(effectiveUserId);
  }
}
