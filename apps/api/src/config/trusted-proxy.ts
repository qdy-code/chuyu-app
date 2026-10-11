import { isIP } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';

export function configureTrustedProxy(app: NestExpressApplication): void {
  const addresses = (process.env.TRUSTED_PROXY_IPS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (addresses.some(address => !isIP(address))) throw new Error('TRUSTED_PROXY_IPS must contain exact proxy IP addresses');
  app.set('trust proxy', addresses.length ? addresses : false);
}
