import { createHmac, timingSafeEqual } from 'node:crypto';

interface TokenPayload {
  sub: string;
  role: 'member' | 'admin';
  version?: number;
  method?: 'password';
  iat: number;
  exp: number;
}

function getSecret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-in-production';
}

export function signToken(sub: string, role: TokenPayload['role'], expiresInSeconds = 86400 * 30, version = 0, method?: 'password'): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub, role, version, ...(method ? { method } : {}), iat: now, exp: now + expiresInSeconds };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const dotIndex = token.indexOf('.');
  if (dotIndex < 1) return null;

  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (!data || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;

  const expected = createHmac('sha256', getSecret()).update(data).digest('base64url');
  if (expected.length !== sig.length) return null;

  const match = timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  if (!match) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as Partial<TokenPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      (payload.role !== 'member' && payload.role !== 'admin') ||
      (payload.version !== undefined && (!Number.isSafeInteger(payload.version) || payload.version < 0)) ||
      (payload.method !== undefined && payload.method !== 'password') ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.iat > now + 60 ||
      payload.exp <= now ||
      payload.exp <= payload.iat
    ) {
      return null;
    }
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
