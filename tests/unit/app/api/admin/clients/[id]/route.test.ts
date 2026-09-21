import assert from 'node:assert';
import test from 'node:test';
import { DELETE, PUT } from '@/app/api/admin/clients/[id]/route';
import { prisma } from '@/platform/db/db';
import { sessionCache, userCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as audit from '@/platform/logging/audit-admin';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const originalUser = prisma.user;

const editar = (json: unknown) =>
  callRoute(PUT, apiRequest('/api/admin/clients/c1', { method: 'PUT', json }), { id: 'c1' });
const excluir = () =>
  callRoute(DELETE, apiRequest('/api/admin/clients/c1', { method: 'DELETE' }), { id: 'c1' });

/** Banco em memória com um cliente; guarda o que foi gravado. */
function banco(existente: Record<string, unknown> | null = { id: 'c1', status: 'active', email: 'c@x.com' }) {
  const gravado: { update?: any; delete?: any } = {};
  prisma.user = {
    findUnique: async () => existente,
    update: async (a: any) => { gravado.update = a.data; return { ...existente, ...a.data }; },
    delete: async (a: any) => { gravado.delete = a.where; return existente; },
  } as any;
  return gravado;
}

test.describe('app/api/admin/clients/[id]', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );
    test.mock.method(sessionCache, 'incrementTokenVersion', async () => 2);
    test.mock.method(userCache, 'invalidate', async () => true);
    test.mock.method(audit, 'logAdminAction', async () => {});
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalUser;
  });

  const revogacoes = () => (sessionCache.incrementTokenVersion as any).mock.calls;

  test('PUT exige a permissão CONTAS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['OPERACOES'] })
    );
    const res = await readApi(await editar({ status: 'blocked' }));
    assert.strictEqual(res.status, 403);
  });

  test('PUT recusa status desconhecido', async () => {
    banco();
    const res = await readApi(await editar({ status: 'banido' }));
    assert.strictEqual(res.status, 400);
  });

  test('PUT responde 404 para cliente inexistente', async () => {
    banco(null);
    const res = await readApi(await editar({ status: 'blocked' }));
    assert.strictEqual(res.status, 404);
  });

  test('PUT grava o status, audita e derruba as sessões do cliente', async () => {
    // A tela "Detalhes da Conta" salva o status por aqui; antes a rota só
    // respondia ok sem gravar nada.
    const gravado = banco();

    const res = await readApi(await editar({ status: 'suspended' }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(gravado.update, { status: 'suspended' });
    assert.strictEqual(revogacoes().length, 1);
    assert.strictEqual(revogacoes()[0].arguments[0], 'c1');
    assert.deepStrictEqual((audit.logAdminAction as any).mock.calls[0].arguments.slice(1, 4), [
      'client_status_change',
      'User',
      'c1',
    ]);
  });

  test('PUT com o mesmo status não grava nem derruba a sessão', async () => {
    const gravado = banco();
    const res = await readApi(await editar({ status: 'active' }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(gravado.update, undefined);
    assert.strictEqual(revogacoes().length, 0);
  });

  test('DELETE responde 404 para cliente inexistente', async () => {
    banco(null);
    const res = await readApi(await excluir());
    assert.strictEqual(res.status, 404);
  });

  test('DELETE exclui e derruba as sessões abertas', async () => {
    const gravado = banco();

    const res = await readApi(await excluir());

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(gravado.delete, { id: 'c1' });
    // Sem revogar, o token de quem foi excluído continuava aceito pelo proxy.
    assert.strictEqual(revogacoes().length, 1);
    assert.strictEqual(revogacoes()[0].arguments[0], 'c1');
  });
});
