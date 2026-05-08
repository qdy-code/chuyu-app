import { NestFactory } from '@nestjs/core';
import './config/load-env';
import { AppModule } from './app.module';
import { DataStoreService } from './store/data-store.service';

async function runSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const store = app.get(DataStoreService);
  await store.resetWithSeed();
  console.log('Seed completed.');
  await app.close();
}

runSeed();
