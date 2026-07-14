import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.production');
if (!existsSync(envPath)) {
  console.error('正式构建已阻止：缺少 apps/admin-web/.env.production');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
    }),
);

const errors = [];
try {
  const url = new URL(env.VITE_API_BASE_URL || '');
  if (url.protocol !== 'https:') errors.push('VITE_API_BASE_URL 必须使用 HTTPS');
  if (/^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)) errors.push('VITE_API_BASE_URL 不能使用本机或局域网地址');
} catch {
  errors.push('VITE_API_BASE_URL 必须是有效的正式 HTTPS 地址');
}
if (env.VITE_ICP_RECORD && /X{4,}|请填写|示例/i.test(env.VITE_ICP_RECORD)) {
  errors.push('VITE_ICP_RECORD 仍是占位内容；没有真实备案号时请留空');
}

if (errors.length) {
  console.error(`正式构建已阻止：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('后台正式环境配置检查通过');
