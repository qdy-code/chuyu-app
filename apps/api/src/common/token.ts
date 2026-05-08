import { createHmac, timingSafeEqual } from 'node:crypto';

interface TokenPayload {
  sub: string;
  role: 'member' | 'admin';
  iat: number;
  exp: number;
}

function getSecret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-in-production';
}

export function signToken(sub: string, role: 'member' | 'admin', expiresInSeconds = 86400 * 30): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub, role, iat: now, exp: now + expiresInSeconds };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const dotIndex = token.indexOf('.');
  if (dotIndex < 1) return null;

  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (!data || !sig) return null;

  const expected = createHmac('sha256', getSecret()).update(data).digest('base64url');
  if (expected.length !== sig.length) return null;

  const match = timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  if (!match) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
