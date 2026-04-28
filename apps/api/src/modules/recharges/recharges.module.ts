import { Module } from '@nestjs/common';
import { RechargesController } from './recharges.controller';

@Module({
  controllers: [RechargesController],
})
export class RechargesModule {}
