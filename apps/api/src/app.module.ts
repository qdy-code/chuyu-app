import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminAuthMiddleware, MemberAuthMiddleware } from './common/auth.middleware';
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(MemberAuthMiddleware)
      .forRoutes('members', 'recharges', 'consumptions');
    consumer
      .apply(AdminAuthMiddleware)
      .forRoutes('admin');
  }
}
