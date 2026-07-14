const FORBIDDEN_SECRETS = new Set([
  '012513',
  'dev-local-secret',
  'dev-secret-change-in-production',
  'change-me-to-a-random-string',
  'your-admin-password',
]);

function required(name: string, errors: string[]): string {
  const value = process.env[name]?.trim() || '';
  if (!value) errors.push(`${name} 未配置`);
  return value;
}

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];
  const jwtSecret = required('JWT_SECRET', errors);
  const adminPassword = required('ADMIN_PASSWORD', errors);
  const databaseUrl = required('DATABASE_URL', errors);
  const corsOrigin = required('CORS_ORIGIN', errors);
  const uploadDir = required('UPLOAD_DIR', errors);
  const appId = required('WECHAT_MINIAPP_APP_ID', errors);
  required('WECHAT_MINIAPP_APP_SECRET', errors);

  if (jwtSecret && (jwtSecret.length < 32 || FORBIDDEN_SECRETS.has(jwtSecret))) {
    errors.push('JWT_SECRET 必须是至少 32 位的随机字符串');
  }
  if (adminPassword && (adminPassword.length < 12 || FORBIDDEN_SECRETS.has(adminPassword))) {
    errors.push('ADMIN_PASSWORD 必须是至少 12 位且未在开发环境使用过的强密码');
  }
  if (process.env.MINIAPP_LOGIN_MODE !== 'real') {
    errors.push('MINIAPP_LOGIN_MODE 必须设置为 real');
  }
  if (appId && !/^wx[a-zA-Z0-9]{16}$/.test(appId)) {
    errors.push('WECHAT_MINIAPP_APP_ID 格式不正确');
  }
  if (databaseUrl && !databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    errors.push('DATABASE_URL 必须使用 PostgreSQL 连接地址');
  }
  if (corsOrigin) {
    const invalidOrigin = corsOrigin
      .split(',')
      .map((item) => item.trim())
      .find((item) => !item.startsWith('https://'));
    if (invalidOrigin) errors.push(`CORS_ORIGIN 生产环境仅允许 HTTPS 来源：${invalidOrigin}`);
  }
  if (uploadDir && !uploadDir.startsWith('/')) {
    errors.push('UPLOAD_DIR 生产环境必须使用持久化磁盘的绝对路径');
  }

  if (errors.length > 0) {
    throw new Error(`生产环境配置校验失败：\n- ${errors.join('\n- ')}`);
  }
}
