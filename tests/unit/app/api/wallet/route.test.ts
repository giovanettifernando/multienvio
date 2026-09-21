import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/wallet/route';
import * as sessionModule from '@/modules/auth/application/session';
import * as balanceService from '@/modules/wallet/application/balance.service';
import { apiRequest, callRoute, readApi } from '../../../../_setup/test-helpers';

const saldo = () => callRoute(GET, apiRequest('/api/wallet'));

test.describe('app/api/wallet', () => {
  test.afterEach(() => test.mock.restoreAll());

  test('responde 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await saldo());
    assert.strictEqual(res.status, 401);
  });

  test('devolve o resumo da carteira de quem está logado', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    const resumo = {
      balance: { availableReais: 100, availableCents: 10_000, pendingReais: 0, pendingCents: 0 },
      monthlySummary: {},
      latestTransactions: [],
    };
    const overview = test.mock.method(balanceService, 'getWalletOverview', async () => resumo);

    const res = await readApi(await saldo());

    assert.strictEqual(res.status, 200);
    assert.strictEqual(overview.mock.calls[0].arguments[0], 'u1');
    assert.deepStrictEqual(res.data, resumo);
  });
});
