import { createHmac } from 'node:crypto';
import { signToken, verifyToken } from './token';

describe('token', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('signs and verifies a member token', () => {
    const payload = verifyToken(signToken('MI000000000001', 'member', 60));
    expect(payload).toMatchObject({ sub: 'MI000000000001', role: 'member' });
  });

  it('rejects tampered and expired tokens', () => {
    const valid = signToken('MI000000000001', 'member', 60);
    expect(verifyToken(`${valid.slice(0, -1)}x`)).toBeNull();
    expect(verifyToken(signToken('MI000000000001', 'member', -1))).toBeNull();
  });

  it('rejects a signed payload with an invalid role', () => {
    const data = Buffer.from(
      JSON.stringify({
        sub: 'MI000000000001',
        role: 'owner',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', process.env.JWT_SECRET!).update(data).digest('base64url');
    expect(verifyToken(`${data}.${signature}`)).toBeNull();
  });
});
