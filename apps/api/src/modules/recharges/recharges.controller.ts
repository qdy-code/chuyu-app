import { Controller, Get, Headers, NotFoundException } from '@nestjs/common';
import { RechargeOrder } from '@member-platform/shared';
import { PospalService } from '../pospal/pospal.service';

@Controller('recharges')
export class RechargesController {
  constructor(private readonly pospal: PospalService) {}

  @Get('my')
  async myOrders(@Headers('x-user-id') userId: string | undefined): Promise<RechargeOrder[]> {
    if (!userId) {
      throw new NotFoundException('member not found');
    }
    return this.pospal.recharges(userId);
  }
}
