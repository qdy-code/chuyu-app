import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.production');

if (!existsSync(envPath)) {
  fail(['缺少 apps/member-miniapp/.env.production，请先根据 .env.production.example 创建正式环境配置']);
}

const env = loadEffectiveEnv();
const errors = [];
const apiBase = env.VITE_API_BASE_URL || '';
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'src/manifest.json'), 'utf8'));
const projectConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'project.config.json'), 'utf8'));
const releaseTarget = JSON.parse(readFileSync(resolve(process.cwd(), 'release-target.json'), 'utf8'));

if (apiBase.replace(/\/$/, '') !== releaseTarget.apiBaseUrl) {
  errors.push(`VITE_API_BASE_URL 必须与已确认的上线地址一致：${releaseTarget.apiBaseUrl}`);
}
if (manifest['mp-weixin']?.appid !== releaseTarget.appid || projectConfig.appid !== releaseTarget.appid) {
  errors.push('小程序 AppID 必须与 release-target.json 一致');
}

try {
  const url = new URL(apiBase);
  if (url.protocol !== 'https:') errors.push('VITE_API_BASE_URL 必须使用 HTTPS');
  if (isPrivateHost(url.hostname)) errors.push('VITE_API_BASE_URL 不能使用 localhost、局域网 IP 或回环地址');
} catch {
  errors.push('VITE_API_BASE_URL 必须是有效的正式 HTTPS 地址');
}

if (env.VITE_DEVTOOLS_API_BASE_URL) errors.push('正式配置中不能设置 VITE_DEVTOOLS_API_BASE_URL');
if (env.VITE_ENABLE_DEV_LOGIN_FALLBACK === 'true') errors.push('正式配置必须关闭 VITE_ENABLE_DEV_LOGIN_FALLBACK');
if (env.VITE_ENABLE_MOCK_PHONE === 'true') errors.push('正式配置必须关闭 VITE_ENABLE_MOCK_PHONE');
if (env.VITE_ENABLE_CATALOG_FALLBACK === 'true') errors.push('正式配置必须关闭 VITE_ENABLE_CATALOG_FALLBACK');
if (!env.VITE_PRIVACY_CONTACT || /请填写|示例|example/i.test(env.VITE_PRIVACY_CONTACT)) {
  errors.push('VITE_PRIVACY_CONTACT 必须填写真实可用的运营者联系方式');
}
if (env.VITE_ICP_RECORD && /X{4,}|请填写|示例/i.test(env.VITE_ICP_RECORD)) {
  errors.push('VITE_ICP_RECORD 仍是占位内容；没有真实备案号时请留空');
}
if (manifest['mp-weixin']?.setting?.urlCheck !== true || projectConfig.setting?.urlCheck !== true) {
  errors.push('正式项目必须开启合法域名校验（urlCheck=true）');
}
if (manifest.uniStatistics?.enable !== false) {
  errors.push('正式项目必须明确关闭未使用的 uniStatistics');
}
if (!/^wx[a-f0-9]{16}$/i.test(manifest['mp-weixin']?.appid || '')) {
  errors.push('manifest.json 缺少有效的微信小程序 AppID');
}

if (errors.length) fail(errors);
console.log('小程序正式环境配置检查通过');

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

function loadEffectiveEnv() {
  const merged = {};
  for (const filename of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const path = resolve(process.cwd(), filename);
    if (existsSync(path)) Object.assign(merged, parseEnv(readFileSync(path, 'utf8')));
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_') && value !== undefined) merged[key] = value;
  }
  return merged;
}

function isPrivateHost(hostname) {
  if (hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.local')) return true;
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const match = /^172\.(\d+)\./.exec(hostname);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function fail(errors) {
  console.error(`正式构建已阻止：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
