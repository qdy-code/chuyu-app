import { Controller, Get, Headers, NotFoundException } from '@nestjs/common';
import { ConsumptionOrder } from '@member-platform/shared';
import { PospalService } from '../pospal/pospal.service';

@Controller('consumptions')
export class ConsumptionsController {
  constructor(private readonly pospal: PospalService) {}

  @Get('my')
  async myOrders(@Headers('x-user-id') userId: string | undefined): Promise<ConsumptionOrder[]> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    return this.pospal.consumptions(userId);
  }
}
