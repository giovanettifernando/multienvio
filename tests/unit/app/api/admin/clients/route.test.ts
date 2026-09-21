import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/admin/clients/route';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

// A tela de contas lê o banco direto no servidor; esta rota ainda é um esqueleto
// que devolve lista vazia. Os testes garantem ao menos o controle de acesso.
const listar = (qs = '') => callRoute(GET, apiRequest(`/api/admin/clients${qs}`));

test.describe('app/api/admin/clients', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await readApi(await listar());
    assert.strictEqual(res.status, 401);
  });

  test('responde 403 sem a permissão CONTAS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['OPERACOES'] })
    );
    const res = await readApi(await listar());
    assert.strictEqual(res.status, 403);
  });

  test('devolve a paginação pedida', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );
    const res = await readApi(await listar('?page=2&pageSize=25'));
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data, { items: [], page: 2, pageSize: 25, total: 0 });
  });
});
