import { Global, Module } from '@nestjs/common';
import { DataStoreService } from './data-store.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, DataStoreService],
  exports: [PrismaService, DataStoreService],
})
export class StoreModule {}
