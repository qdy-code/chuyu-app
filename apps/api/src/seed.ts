import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataStoreService } from './store/data-store.service';

async function runSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const store = app.get(DataStoreService);
  store.resetWithSeed();
  console.log('Seed completed. Demo member id: u-demo-001, admin id: admin-001');
  await app.close();
}

runSeed();
