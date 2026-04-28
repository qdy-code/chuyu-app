import { Module } from '@nestjs/common';
import { ConsumptionsController } from './consumptions.controller';

@Module({
  controllers: [ConsumptionsController],
})
export class ConsumptionsModule {}
