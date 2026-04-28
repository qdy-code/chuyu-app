import { Body, Controller, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common';
import { RechargeOrder } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { RechargeApplyDto } from './dto';

@Controller('recharges')
export class RechargesController {
  constructor(private readonly store: DataStoreService) {}

  @Post('apply')
  apply(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: RechargeApplyDto,
  ): RechargeOrder {
    const effectiveUserId = userId || this.store.listMembers()[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }
    return this.store.applyRecharge(effectiveUserId, payload);
  }

  @Get('my')
  myOrders(@Headers('x-user-id') userId: string | undefined): RechargeOrder[] {
    const effectiveUserId = userId || this.store.listMembers()[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }
    return this.store.listRechargeOrders(effectiveUserId);
  }

  @Get(':id')
  detail(@Param('id') id: string): RechargeOrder {
    const found = this.store.getRechargeById(id);
    if (!found) {
      throw new NotFoundException('recharge order not found');
    }
    return found;
  }
}
