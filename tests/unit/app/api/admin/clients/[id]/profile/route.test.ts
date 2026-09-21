import assert from 'node:assert';
import test from 'node:test';
import { PUT } from '@/app/api/admin/clients/[id]/profile/route';
import { prisma } from '@/platform/db/db';
import { sessionCache, userCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../../_setup/test-helpers';

const originalUser = prisma.user;
const atual = { id: 'c1', email: 'c@x.com', status: 'active' };

const editar = (json: unknown) =>
  callRoute(PUT, apiRequest('/api/admin/clients/c1/profile', { method: 'PUT', json }), { id: 'c1' });

function banco(outros: Record<string, unknown> = {}) {
  const gravado: { data?: any } = {};
  prisma.user = {
    findUnique: async (a: any) => (a.where.id === 'c1' ? atual : outros[a.where.email] ?? null),
    update: async (a: any) => { gravado.data = a.data; return { ...atual, ...a.data }; },
  } as any;
  return gravado;
}

test.describe('app/api/admin/clients/[id]/profile', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );
    test.mock.method(sessionCache, 'incrementTokenVersion', async () => 2);
    test.mock.method(userCache, 'invalidate', async () => true);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalUser;
  });

  const revogacoes = () => (sessionCache.incrementTokenVersion as any).mock.calls;

  test('exige a permissão CONTAS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['SUPORTE'] })
    );
    const res = await readApi(await editar({ name: 'Novo' }));
    assert.strictEqual(res.status, 403);
  });

  test('recusa e-mail que já é de outra conta', async () => {
    banco({ 'outro@x.com': { id: 'c2' } });
    const res = await readApi(await editar({ email: 'outro@x.com' }));
    assert.strictEqual(res.status, 400);
  });

  test('editar só dados cadastrais não derruba a sessão', async () => {
    const gravado = banco();
    const res = await readApi(await editar({ name: 'Novo Nome', phone: '11999999999' }));
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(gravado.data, { name: 'Novo Nome', phone: '11999999999' });
    assert.strictEqual(revogacoes().length, 0);
  });

  test('mudar o status derruba as sessões do cliente', async () => {
    banco();
    const res = await readApi(await editar({ status: 'blocked' }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(revogacoes().length, 1);
    assert.strictEqual(revogacoes()[0].arguments[0], 'c1');
  });

  test('trocar o e-mail derruba as sessões do cliente', async () => {
    banco();
    const res = await readApi(await editar({ email: 'novo@x.com' }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(revogacoes().length, 1);
  });
});
