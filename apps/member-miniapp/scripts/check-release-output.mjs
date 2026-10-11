import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const outputDir = resolve(process.cwd(), 'dist/build/mp-weixin');
const productionEnvPath = resolve(process.cwd(), '.env.production');
const errors = [];

if (!existsSync(outputDir)) fail(['正式构建产物不存在']);

const textExtensions = new Set(['.js', '.json', '.sjs', '.wxml', '.wxss', '.txt']);
const textFiles = walk(outputDir).filter((path) => textExtensions.has(extname(path)));
const files = textFiles.map((path) => ({ path, content: readFileSync(path, 'utf8') }));
const combined = files.map((file) => file.content).join('\n');
const localUrlPattern = /https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?=[:/"'`]|$)/i;

for (const file of files) {
  if (localUrlPattern.test(file.content)) {
    errors.push(`产物包含本机或局域网地址：${relative(outputDir, file.path)}`);
  }
  if (/https?:\/\/api\.example\.com/i.test(file.content)) {
    errors.push(`产物包含示例 API 地址：${relative(outputDir, file.path)}`);
  }
}

const productionEnv = parseEnv(readFileSync(productionEnvPath, 'utf8'));
const expectedApi = productionEnv.VITE_API_BASE_URL;
if (!expectedApi || !combined.includes(expectedApi)) {
  errors.push('产物中未找到 .env.production 配置的正式 API 地址');
}
for (const domain of ['moonisle.shop', 'chuy.shop']) {
  if (expectedApi && new URL(expectedApi).hostname !== domain && combined.includes(`https://${domain}/api`)) {
    errors.push(`产物仍包含非当前环境的 API 域名：${domain}`);
  }
}
const privacyContact = productionEnv.VITE_PRIVACY_CONTACT || '';
if (!privacyContact || !combined.includes(privacyContact)) {
  errors.push('产物中未找到正式隐私联系人');
}

const projectConfigPath = join(outputDir, 'project.config.json');
if (!existsSync(projectConfigPath)) {
  errors.push('产物缺少 project.config.json');
} else {
  const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'));
  if (projectConfig.appid !== 'wx1cf2caed662f562a') errors.push('产物 AppID 不正确');
  if (projectConfig.setting?.urlCheck !== true) errors.push('产物未开启合法域名校验');
}

const sourceMaps = walk(outputDir).filter((path) => path.endsWith('.map'));
if (sourceMaps.length > 0) errors.push('正式产物包含 source map');

const totalBytes = walk(outputDir).reduce((sum, path) => sum + statSync(path).size, 0);
if (totalBytes > 2 * 1024 * 1024) errors.push(`正式产物超过 2 MB：${totalBytes} bytes`);

if (errors.length) fail(errors);
console.log(`小程序正式产物检查通过（${totalBytes} bytes）`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

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

function fail(messages) {
  console.error(`正式产物检查失败：\n- ${messages.join('\n- ')}`);
  process.exit(1);
}
