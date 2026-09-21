import assert from 'node:assert';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { prisma } from '@/platform/db/db';

let POST: typeof import('../../../../../../app/api/auth/login/route.ts').POST;
let rateLimitModule: any;
let originalRateLimit: unknown;

const originalPrisma = { user: prisma.user };
const intervals: NodeJS.Timeout[] = [];
const originalSetInterval = global.setInterval;

test.before(async () => {
  (globalThis as any).setInterval = (...args: any[]) => {
    const handle = originalSetInterval(...(args as [any, number]));
    intervals.push(handle);
    return handle;
  };
  ({ POST } = await import('../../../../../../app/api/auth/login/route.ts'));
  rateLimitModule = await import('../../../../../../platform/api/rate-limit.ts');
  originalRateLimit = rateLimitModule.rateLimitByIP as unknown;
  (globalThis as any).setInterval = originalSetInterval;
});

test.describe('app/api/auth/login/route', () => {
  test.afterEach(() => {
    prisma.user = originalPrisma.user;
    if (rateLimitModule) {
      rateLimitModule.rateLimitByIP = originalRateLimit;
    }
    intervals.forEach((h) => clearInterval(h));
    intervals.length = 0;
  });

  test('retorna 401 para usuário inexistente ou sem hash', async () => {
    rateLimitModule.rateLimitByIP = () => null;
    prisma.user = { findUnique: async () => null } as any;
    const req = new Request('http://test', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: '123456' }) });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
  });

  test('retorna 401 quando senha inválida', async () => {
    rateLimitModule.rateLimitByIP = () => null;
    const dbUser = {
      id: 'u1',
      email: 'a@b.com',
      passwordHash: await bcrypt.hash('secret', 10),
      emailVerified: true,
      status: 'ACTIVE',
      role: { name: 'user' },
      tokenVersion: 0,
      name: 'User',
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };
    prisma.user = {
      findUnique: async () => dbUser,
      update: async () => ({}),
    } as any;

    const req = new Request('http://test', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'wrongpw' }) });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
  });

  test('retorna 403 para email não verificado ou status inativo', async () => {
    rateLimitModule.rateLimitByIP = () => null;
    const baseUser = {
      id: 'u1',
      email: 'a@b.com',
      passwordHash: await bcrypt.hash('secret', 10),
      emailVerified: false,
      status: 'ACTIVE',
      role: { name: 'user' },
      tokenVersion: 0,
      name: 'User',
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };
    prisma.user = { findUnique: async () => baseUser } as any;
    let res = await POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'secret' }) }));
    assert.strictEqual(res.status, 403);

    prisma.user = { findUnique: async () => ({ ...baseUser, emailVerified: true, status: 'BLOCKED' }) } as any;
    res = await POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'secret' }) }));
    assert.strictEqual(res.status, 403);
  });

  test('retorna 422 para payload inválido', async () => {
    rateLimitModule.rateLimitByIP = () => null;
    const res = await POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ email: 123, password: 456 }) }));
    assert.strictEqual(res.status, 422);
  });

  test('rate limit bloqueia requisições', async () => {
    rateLimitModule.rateLimitByIP = () => new Response('Rate limited', { status: 429 });
    const res = await POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'x' }) }));
    assert.strictEqual(res.status, 429);
  });
});
