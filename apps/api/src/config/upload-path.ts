import { resolve } from 'node:path';

export function getUploadDir(): string {
  const cwd = process.cwd().replace(/\\/g, '/');
  if (cwd.endsWith('/apps/api')) {
    return resolve(process.cwd(), 'uploads');
  }
  return resolve(process.cwd(), 'apps', 'api', 'uploads');
}
