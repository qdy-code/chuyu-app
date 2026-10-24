import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [filename, domain, appId] = process.argv.slice(2);
if (!filename || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain || '') || !/^wx[a-f0-9]{16}$/.test(appId || '')) {
  throw new Error('Usage: node configure-public-env.mjs <env-file> <domain> <wechat-app-id>');
}

const target = resolve(filename);
const updates = new Map([
  ['APP_DOMAIN', domain],
  ['CORS_ORIGIN', `https://${domain}`],
  ['WECHAT_MINIAPP_APP_ID', appId],
]);
const lines = readFileSync(target, 'utf8').trimEnd().split(/\r?\n/).map((line) => {
  const key = line.slice(0, line.indexOf('=')).trim();
  if (!updates.has(key)) return line;
  return `${key}=${updates.get(key)}`;
});
for (const [key, value] of updates) {
  if (!lines.some((line) => line.startsWith(`${key}=`))) lines.push(`${key}=${value}`);
}
const temporary = `${target}.${process.pid}.tmp`;
writeFileSync(temporary, `${lines.join('\n')}\n`, { mode: 0o600, flag: 'wx' });
renameSync(temporary, target);
console.log(`Public configuration updated: https://${domain}, AppID ${appId}`);
