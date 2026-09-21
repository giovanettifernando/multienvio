import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/clients/unblock/route';
import { prisma } from '@/platform/db/db';
import { userCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as audit from '@/platform/logging/audit-admin';
import * as rateLimit from '@/platform/cache/rate-limit-redis';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const originalUser = prisma.user;

const desbloquear = (body: unknown) =>
  callRoute(POST, apiRequest('/api/admin/clients/unblock', { json: body }));

test.describe('app/api/admin/clients/unblock', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );
    test.mock.method(rateLimit, 'rateLimitByUser', async () => null);
    test.mock.method(audit, 'logClientStatusChange', async () => {});
    test.mock.method(userCache, 'invalidate', async () => true);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalUser;
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await readApi(await desbloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 401);
  });

  test('responde 429 quando o limite estoura', async () => {
    test.mock.method(rateLimit, 'rateLimitByUser', async () => Response.json({}, { status: 429 }));
    const res = await readApi(await desbloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 429);
  });

  test('responde 400 sem clientId', async () => {
    const res = await readApi(await desbloquear({}));
    assert.strictEqual(res.status, 400);
  });

  test('responde 404 para cliente inexistente', async () => {
    prisma.user = { findUnique: async () => null } as any;
    const res = await readApi(await desbloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 404);
  });

  test('recusa desbloquear quem não está bloqueado', async () => {
    prisma.user = { findUnique: async () => ({ id: 'c1', status: 'active', email: 'c@x.com' }) } as any;
    const res = await readApi(await desbloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error?.code, 'INVALID_STATE');
  });

  test('reativa, audita e limpa o cache do cliente', async () => {
    let novoStatus: string | undefined;
    prisma.user = {
      findUnique: async () => ({ id: 'c1', status: 'blocked', email: 'c@x.com' }),
      update: async (a: any) => { novoStatus = a.data.status; return {}; },
    } as any;

    const res = await readApi(await desbloquear({ clientId: 'c1', reason: 'engano' }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data, { ok: true });
    assert.strictEqual(novoStatus, 'active');
    assert.deepStrictEqual(
      (audit.logClientStatusChange as any).mock.calls[0].arguments,
      ['s1', 'c1', 'unblock', 'engano']
    );
    assert.strictEqual((userCache.invalidate as any).mock.calls[0].arguments[0], 'c1');
  });
});
