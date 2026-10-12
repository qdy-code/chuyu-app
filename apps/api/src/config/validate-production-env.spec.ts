import { validateProductionEnv } from './validate-production-env';

describe('validateProductionEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('does not require production settings in development', () => {
    process.env.NODE_ENV = 'development';
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('rejects incomplete or misspelled Pospal accounting configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.POSPAL_ACCOUNT_SOURCE = 'pospal';
    process.env.POSPAL_ENABLED = 'false';
    delete process.env.POSPAL_APP_KEY;
    expect(() => validateProductionEnv()).toThrow('POSPAL_ENABLED=true');
    expect(() => validateProductionEnv()).toThrow('POSPAL_APP_KEY');
    process.env.POSPAL_ACCOUNT_SOURCE = 'pospla';
    expect(() => validateProductionEnv()).toThrow('POSPAL_ACCOUNT_SOURCE');
  });

  it('rejects development credentials in production', () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      JWT_SECRET: 'dev-local-secret',
      ADMIN_PASSWORD: '012513',
      DATABASE_URL: 'postgresql://localhost/moonisle',
      CORS_ORIGIN: 'http://localhost:5173',
      UPLOAD_DIR: 'uploads',
      MINIAPP_LOGIN_MODE: 'mock',
      WECHAT_MINIAPP_APP_ID: 'invalid',
      WECHAT_MINIAPP_APP_SECRET: 'secret',
    });
    expect(() => validateProductionEnv()).toThrow('生产环境配置校验失败');
  });

  it('accepts a complete production configuration', () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      JWT_SECRET: 'a-random-jwt-secret-with-more-than-32-characters',
      ADMIN_PASSWORD: 'a-strong-admin-password-2026',
      DATABASE_URL: 'postgresql://user:password@database.example.com/moonisle',
      CORS_ORIGIN: 'https://admin.example.com',
      UPLOAD_DIR: '/data/moonisle/uploads',
      MINIAPP_LOGIN_MODE: 'real',
      WECHAT_MINIAPP_APP_ID: 'wx15be87c3c8436c26',
      WECHAT_MINIAPP_APP_SECRET: '8f43c6d81a70b9254e63d0927b41ca56',
    });
    expect(() => validateProductionEnv()).not.toThrow();
  });
});
