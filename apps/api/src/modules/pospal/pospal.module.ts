import { PospalMemberSyncService } from './pospal-member-sync.service';
import { Global, Module } from '@nestjs/common';
import { PospalClientService } from './pospal-client.service';
import { PospalController } from './pospal.controller';
import { PospalService } from './pospal.service';
import { ConsumptionPhotosService } from './consumption-photos.service';
import { ConsumptionPhotosAdminController, ConsumptionPhotoMediaController } from './consumption-photos.controller';

@Global()
@Module({
  providers: [PospalClientService, PospalService, PospalMemberSyncService, ConsumptionPhotosService],
  controllers: [PospalController, ConsumptionPhotosAdminController, ConsumptionPhotoMediaController],
  exports: [PospalService],
})
export class PospalModule {}
