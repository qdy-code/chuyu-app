import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidateEnvFiles = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(__dirname, '../../.env'),
];

for (const envFile of candidateEnvFiles) {
  if (existsSync(envFile)) {
    config({ path: envFile, override: false });
  }
}
