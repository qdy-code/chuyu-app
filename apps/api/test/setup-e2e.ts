import { join } from 'node:path';
import { tmpdir } from 'node:os';

const databaseUrl = process.env.E2E_DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error('E2E_DATABASE_URL is required and must point to a dedicated test database.');
}

let databaseName = '';
try {
  const parsed = new URL(databaseUrl);
  databaseName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) || '');
} catch {
  throw new Error('E2E_DATABASE_URL must be a valid PostgreSQL connection URL.');
}

if (!/(test|e2e)/i.test(databaseName)) {
  throw new Error(
    `Refusing to reset database "${databaseName || '(unknown)'}"; its name must contain test or e2e.`,
  );
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL === databaseUrl) {
  throw new Error('E2E_DATABASE_URL must not be the same as DATABASE_URL.');
}

process.env.DATABASE_URL = databaseUrl;
if (!process.env.E2E_UPLOAD_DIR) {
  process.env.E2E_UPLOAD_DIR = join(tmpdir(), `moonisle-api-e2e-${process.pid}`);
  process.env.E2E_MANAGED_UPLOAD_DIR = 'true';
}
process.env.UPLOAD_DIR = process.env.E2E_UPLOAD_DIR;
