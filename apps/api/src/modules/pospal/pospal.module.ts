import { Global, Module } from '@nestjs/common';
import { PospalClientService } from './pospal-client.service';
import { PospalController } from './pospal.controller';
import { PospalService } from './pospal.service';

@Global()
@Module({
  providers: [PospalClientService, PospalService],
  controllers: [PospalController],
  exports: [PospalService],
})
export class PospalModule {}
