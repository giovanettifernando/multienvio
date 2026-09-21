import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/payment-transactions/[id]/refund/route';
import { prisma } from '@/platform/db/db';
import * as charges from '@/platform/integrations/asaas/charges';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as userSessionModule from '@/modules/auth/application/user-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../../_setup/test-helpers';

const originalPaymentTransaction = prisma.paymentTransaction;

const estornar = (json?: unknown) =>
  callRoute(POST, apiRequest('/api/admin/payment-transactions/t1/refund', { method: 'POST', json }), { id: 't1' });

function banco(transacao: Record<string, unknown> | null) {
  const gravado: { data?: any } = {};
  prisma.paymentTransaction = {
    findUnique: async () => transacao,
    update: async (a: any) => { gravado.data = a.data; return {}; },
  } as any;
  return gravado;
}

const pago = (extra: Record<string, unknown> = {}) => ({
  id: 't1',
  userId: 'u1',
  status: 'PAID',
  amountCents: 10_000,
  externalId: 'pay_1',
  gateway: { slug: 'asaas' },
  metadata: { type: 'wallet_topup' },
  ...extra,
});

test.describe('app/api/admin/payment-transactions/[id]/refund', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['FINANCEIRO'] })
    );
    test.mock.method(charges, 'refundCharge', async () => ({ status: 'REFUNDED' }));
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.paymentTransaction = originalPaymentTransaction;
  });

  test('o próprio cliente não consegue estornar (só staff)', async () => {
    // Antes a rota ficava em /api/payments e aceitava o dono do pagamento:
    // recarregar no cartão, gastar o saldo em etiquetas e estornar o cartão.
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
    test.mock.method(userSessionModule, 'getUserSessionFromRequest', async () => ({ userId: 'u1', role: 'user' }));
    banco(pago());

    const res = await readApi(await estornar());

    assert.strictEqual(res.status, 401);
    assert.strictEqual((charges.refundCharge as any).mock.callCount(), 0);
  });

  test('exige a permissão FINANCEIRO', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['INTEGRACOES'] })
    );
    const res = await readApi(await estornar());
    assert.strictEqual(res.status, 403);
  });

  test('responde 404 para transação inexistente', async () => {
    banco(null);
    const res = await readApi(await estornar());
    assert.strictEqual(res.status, 404);
  });

  test('recusa pagamento que ainda não foi pago', async () => {
    banco(pago({ status: 'PENDING' }));
    const res = await readApi(await estornar());
    assert.strictEqual(res.status, 400);
  });

  test('recusa valor acima do que resta estornar', async () => {
    banco(pago({ metadata: { refundedCents: 8_000 } }));
    const res = await readApi(await estornar({ amount: 30 }));
    assert.strictEqual(res.status, 400);
    assert.match(res.error.message, /R\$ 20\.00/);
  });

  test('estorno total no Asaas registra quem estornou', async () => {
    const gravado = banco(pago());

    const res = await readApi(await estornar({ reason: 'pedido do cliente' }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual((charges.refundCharge as any).mock.calls[0].arguments, ['pay_1', undefined]);
    assert.strictEqual(gravado.data.status, 'REFUNDED');
    assert.strictEqual(gravado.data.metadata.refundedCents, 10_000);
    assert.strictEqual(gravado.data.metadata.lastRefund.by, 's1');
    assert.strictEqual(gravado.data.metadata.type, 'wallet_topup', 'o metadata original é preservado');
  });

  test('estorno parcial manda o valor em centavos', async () => {
    const gravado = banco(pago());
    const res = await readApi(await estornar({ amount: 12.34 }));
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual((charges.refundCharge as any).mock.calls[0].arguments, ['pay_1', 1234]);
    assert.strictEqual(gravado.data.metadata.refundedCents, 1234);
  });
});
