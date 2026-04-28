import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { MembersModule } from './modules/members/members.module';
import { RechargesModule } from './modules/recharges/recharges.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { ConsumptionsModule } from './modules/consumptions/consumptions.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [
    StoreModule,
    AuthModule,
    MembersModule,
    RechargesModule,
    AdminModule,
    AuditModule,
    ConsumptionsModule,
  ],
})
export class AppModule {}
