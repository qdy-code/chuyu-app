import { Body, Controller, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common';
import { RechargeOrder } from '@member-platform/shared';
import { DataStoreService } from '../../store/data-store.service';
import { RechargeApplyDto } from './dto';

@Controller('recharges')
export class RechargesController {
  constructor(private readonly store: DataStoreService) {}

  @Post('apply')
  async apply(
    @Headers('x-user-id') userId: string | undefined,
    @Body() payload: RechargeApplyDto,
  ): Promise<RechargeOrder> {
    const members = userId ? [] : await this.store.listMembers();
    const effectiveUserId = userId || members[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }
    return this.store.applyRecharge(effectiveUserId, payload);
  }

  @Get('my')
  async myOrders(@Headers('x-user-id') userId: string | undefined): Promise<RechargeOrder[]> {
    const members = userId ? [] : await this.store.listMembers();
    const effectiveUserId = userId || members[0]?.id;
    if (!effectiveUserId) {
      throw new NotFoundException('member not found');
    }
    return this.store.listRechargeOrders(effectiveUserId);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<RechargeOrder> {
    const found = await this.store.getRechargeById(id);
    if (!found) {
      throw new NotFoundException('recharge order not found');
    }
    return found;
  }
}
