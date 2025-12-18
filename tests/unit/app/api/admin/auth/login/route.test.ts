import assert from 'node:assert';
import test from 'node:test';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@/platform/db/db';

const originalStaff = prisma.staffUser;
const originalSetInterval = global.setInterval;
let POST: any;

function makeRequest(body: any) {
  return new Request('http://test/api/admin/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('app/api/admin/auth/login', () => {
  let schemaModule: any;
  let rateLimitModule: any;
  let adminSessionModule: any;
  let auditModule: any;
  let cacheModule: any;

  test.before(async () => {
    // Evita timers pendurados do rate-limit
    // @ts-ignore
    global.setInterval = (fn: any) => {
      fn();
      return { unref: () => {}, ref: () => {} } as any;
    };
    schemaModule = await import('../../../../../../../lib/validation/admin-auth.ts');
    rateLimitModule = await import('../../../../../../../lib/rate-limit.ts');
    adminSessionModule = await import('../../../../../../../lib/auth/admin-session.ts');
    auditModule = await import('../../../../../../../lib/audit-admin.ts');
    cacheModule = await import('../../../../../../../lib/cache.ts');
    prisma.staffUser = { findUnique: async () => null, update: async () => ({}) } as any;
    ({ POST } = await import('../../../../../../../app/api/admin/auth/login/route.ts'));
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.staffUser = originalStaff;
    global.setInterval = originalSetInterval;
  });

  test('retorna 422 quando payload inválido', async () => {
    test.mock.method(rateLimitModule, 'rateLimitByIP', () => null);
    test.mock.method(schemaModule.AdminLoginSchema, 'parse', () => {
      throw new ZodError([{ path: ['email'], message: 'invalid', code: 'custom' } as any]);
    });
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 422);
  });

  test('retorna 401 quando usuário não encontrado', async () => {
    test.mock.method(rateLimitModule, 'rateLimitByIP', () => null);
    test.mock.method(schemaModule.AdminLoginSchema, 'parse', (p: any) => p);
    prisma.staffUser = { findUnique: async () => null } as any;
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'x' }));
    assert.strictEqual(res.status, 401);
  });

  test('retorna 403 quando usuário inativo', async () => {
    test.mock.method(rateLimitModule, 'rateLimitByIP', () => null);
    test.mock.method(schemaModule.AdminLoginSchema, 'parse', (p: any) => p);
    test.mock.method(bcrypt, 'compare', async () => true);
    prisma.staffUser = {
      findUnique: async () => ({
        id: 's1',
        email: 'a@b.com',
        passwordHash: 'hash',
        status: 'BLOCKED',
        isSuperAdmin: false,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        lastAccessAt: null,
        role: { name: 'operator' },
      }),
    } as any;
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'x' }));
    assert.strictEqual(res.status, 403);
  });

  test('realiza login com sucesso e seta cookie', async () => {
    test.mock.method(rateLimitModule, 'rateLimitByIP', () => null);
    test.mock.method(schemaModule.AdminLoginSchema, 'parse', (p: any) => p);
    test.mock.method(bcrypt, 'compare', async () => true);
    test.mock.method(adminSessionModule, 'adminSign', async () => 'token');
    test.mock.method(adminSessionModule, 'createAdminCookieHeader', () => 'admin=token; Path=/');
    test.mock.method(auditModule, 'logAdminLogin', async () => {});
    // Mock Redis cache for tokenVersion
    test.mock.method(cacheModule.staffSessionCache, 'getOrInitTokenVersion', async () => 1);
    test.mock.method(cacheModule.staffSessionCache, 'set', async () => true);
    prisma.staffUser = {
      findUnique: async () => ({
        id: 's1',
        email: 'a@b.com',
        passwordHash: 'hash',
        status: 'ACTIVE',
        isSuperAdmin: false,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        lastAccessAt: null,
        role: { name: 'operator' },
      }),
      update: async ({ data }: any) => ({ id: 's1', ...data }),
    } as any;

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret' }));
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('set-cookie')?.includes('admin=token'));
    const body = await res.json();
    assert.strictEqual(body.staff.id, 's1');
  });
});
