import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/clients/block/route';
import { prisma } from '@/platform/db/db';
import { sessionCache, userCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as audit from '@/platform/logging/audit-admin';
import * as rateLimit from '@/platform/cache/rate-limit-redis';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const originalUser = prisma.user;

const bloquear = (body: unknown) =>
  callRoute(POST, apiRequest('/api/admin/clients/block', { json: body }));

test.describe('app/api/admin/clients/block', () => {
  test.beforeEach(() => {
    test.mock.method(rateLimit, 'rateLimitByUser', async () => null);
    test.mock.method(audit, 'logClientStatusChange', async () => {});
    test.mock.method(sessionCache, 'incrementTokenVersion', async () => 2);
    test.mock.method(userCache, 'invalidate', async () => true);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalUser;
  });

  const comPermissao = () =>
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );

  test('responde 401 sem sessão', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await readApi(await bloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 401);
  });

  test('responde 403 para staff sem a permissão CONTAS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['OPERACOES'] })
    );
    const res = await readApi(await bloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 403);
  });

  test('responde 429 quando o limite estoura', async () => {
    comPermissao();
    test.mock.method(rateLimit, 'rateLimitByUser', async () => Response.json({}, { status: 429 }));
    const res = await readApi(await bloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 429);
  });

  test('responde 400 sem clientId', async () => {
    comPermissao();
    const res = await readApi(await bloquear({}));
    assert.strictEqual(res.status, 400);
  });

  test('responde 404 para cliente inexistente', async () => {
    comPermissao();
    prisma.user = { findUnique: async () => null } as any;
    const res = await readApi(await bloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 404);
  });

  test('recusa bloquear quem já está bloqueado', async () => {
    comPermissao();
    prisma.user = { findUnique: async () => ({ id: 'c1', status: 'blocked', email: 'c@x.com' }) } as any;
    const res = await readApi(await bloquear({ clientId: 'c1' }));
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error?.code, 'INVALID_STATE');
  });

  test('bloqueia, audita e derruba na hora as sessões abertas do cliente', async () => {
    comPermissao();
    let novoStatus: string | undefined;
    prisma.user = {
      findUnique: async () => ({ id: 'c1', status: 'active', email: 'c@x.com' }),
      update: async (a: any) => { novoStatus = a.data.status; return {}; },
    } as any;

    const res = await readApi(await bloquear({ clientId: 'c1', reason: 'fraude' }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data, { ok: true });
    assert.strictEqual(novoStatus, 'blocked');
    assert.deepStrictEqual(
      (audit.logClientStatusChange as any).mock.calls[0].arguments,
      ['s1', 'c1', 'block', 'fraude']
    );
    // Sem isto o cliente bloqueado seguia logado até a sessão expirar (7 dias):
    // o proxy confia no status guardado no Redis no login.
    const revogou = (sessionCache.incrementTokenVersion as any).mock.calls;
    assert.strictEqual(revogou.length, 1, 'as sessões do cliente precisam ser revogadas');
    assert.strictEqual(revogou[0].arguments[0], 'c1');
  });
});
