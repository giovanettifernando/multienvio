import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/payment-transactions/sync/route';
import { prisma } from '@/platform/db/db';
import * as asaasTracking from '@/platform/integrations/asaas/tracking';
import * as walletService from '@/modules/wallet/application/wallet.service';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const originalPaymentTransaction = prisma.paymentTransaction;

const sincronizar = (json: unknown) =>
  callRoute(POST, apiRequest('/api/admin/payment-transactions/sync', { json }));

function banco(existente: Record<string, unknown> | null, depois: Record<string, unknown> = {}) {
  prisma.paymentTransaction = {
    findFirst: async () => existente,
    findUnique: async () => (existente ? { ...existente, ...depois } : null),
  } as any;
}

test.describe('app/api/admin/payment-transactions/sync', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['INTEGRACOES'] })
    );
    test.mock.method(asaasTracking, 'updatePaymentFromAsaas', async () => {});
    test.mock.method(walletService, 'creditTopupIfReleased', async () => true);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.paymentTransaction = originalPaymentTransaction;
  });

  test('exige a permissão INTEGRACOES', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );
    const res = await readApi(await sincronizar({ externalId: 'pay_1' }));
    assert.strictEqual(res.status, 403);
  });

  test('responde 400 sem externalId', async () => {
    const res = await readApi(await sincronizar({}));
    assert.strictEqual(res.status, 400);
  });

  test('responde 404 para cobrança que não é nossa', async () => {
    banco(null);
    const res = await readApi(await sincronizar({ externalId: 'pay_x' }));
    assert.strictEqual(res.status, 404);
    assert.strictEqual((asaasTracking.updatePaymentFromAsaas as any).mock.callCount(), 0);
  });

  test('atualiza pelo Asaas e credita a recarga liberada', async () => {
    // O monitor de PIX só olha cobranças PENDING: se o sync marcasse PAID sem
    // creditar, a recarga paga nunca viraria saldo.
    banco(
      { id: 't1', externalId: 'pay_1', status: 'PENDING', amountCents: 5000 },
      { status: 'PAID' }
    );

    const res = await readApi(await sincronizar({ externalId: 'pay_1' }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual((asaasTracking.updatePaymentFromAsaas as any).mock.calls[0].arguments[0], 'pay_1');
    assert.strictEqual((walletService.creditTopupIfReleased as any).mock.calls[0].arguments[0], 't1');
    assert.deepStrictEqual(res.data.transaction, { id: 't1', status: 'PAID', externalId: 'pay_1', amountCents: 5000 });
  });

  test('erro do Asaas não credita nada', async () => {
    banco({ id: 't1', externalId: 'pay_1', status: 'PENDING', amountCents: 5000 });
    test.mock.method(asaasTracking, 'updatePaymentFromAsaas', async () => {
      throw new Error('asaas fora');
    });

    const res = await readApi(await sincronizar({ externalId: 'pay_1' }));

    assert.strictEqual(res.status, 500);
    assert.strictEqual((walletService.creditTopupIfReleased as any).mock.callCount(), 0);
  });
});
