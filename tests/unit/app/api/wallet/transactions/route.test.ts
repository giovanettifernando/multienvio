import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/wallet/transactions/route';
import * as sessionModule from '@/modules/auth/application/session';
import * as statementService from '@/modules/wallet/application/statement.service';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const extrato = (qs = '') => callRoute(GET, apiRequest(`/api/wallet/transactions${qs}`));

test.describe('app/api/wallet/transactions', () => {
  test.afterEach(() => test.mock.restoreAll());

  test('responde 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await extrato());
    assert.strictEqual(res.status, 401);
  });

  test('repassa filtros e paginação para o extrato do próprio usuário', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    const statement = test.mock.method(statementService, 'getWalletStatement', async () => ({ items: [] }));

    const res = await readApi(await extrato('?dateFrom=2026-01-01&dateTo=2026-01-31&search=ME123&page=2&limit=20'));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(statement.mock.calls[0].arguments, [
      'u1',
      { dateFrom: '2026-01-01', dateTo: '2026-01-31', search: 'ME123' },
      { page: 2, limit: 20 },
    ]);
  });

  test('sem parâmetros usa página 1 com 50 itens', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    const statement = test.mock.method(statementService, 'getWalletStatement', async () => ({ items: [] }));
    await extrato();
    assert.deepStrictEqual(statement.mock.calls[0].arguments[2], { page: 1, limit: 50 });
  });
});
