import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/payment-transactions/[id]/force-approve/route';
import { prisma } from '@/platform/db/db';
import * as walletService from '@/modules/wallet/application/wallet.service';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../../_setup/test-helpers';

const original = { paymentTransaction: prisma.paymentTransaction, $transaction: prisma.$transaction };

const aprovar = (json?: unknown) =>
  callRoute(
    POST,
    apiRequest('/api/admin/payment-transactions/t1/force-approve', { method: 'POST', json }),
    { id: 't1' }
  );

function banco(existente: Record<string, unknown> | null) {
  const gravado: { update?: any; ledger?: any } = {};
  prisma.paymentTransaction = { findUnique: async () => existente } as any;
  prisma.$transaction = (async (fn: any) =>
    fn({
      paymentTransaction: {
        update: async (a: any) => { gravado.update = a.data; return { ...existente, ...a.data }; },
      },
      ledgerEntry: { create: async (a: any) => { gravado.ledger = a.data; return {}; } },
    })) as any;
  return gravado;
}

const pendente = (metadata: Record<string, unknown> = {}) => ({
  id: 't1',
  userId: 'u1',
  status: 'PENDING',
  amountCents: 5000,
  externalId: 'pay_1',
  metadata,
});

test.describe('app/api/admin/payment-transactions/[id]/force-approve', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['FINANCEIRO'], email: 'fin@empresa.com' })
    );
    test.mock.method(walletService, 'creditFromGatewayTopup', async () => ({}));
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, original);
  });

  test('exige a permissão FINANCEIRO', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['INTEGRACOES'] })
    );
    const res = await readApi(await aprovar());
    assert.strictEqual(res.status, 403);
  });

  test('responde 404 para pagamento inexistente', async () => {
    banco(null);
    const res = await readApi(await aprovar());
    assert.strictEqual(res.status, 404);
  });

  test('recusa pagamento que já está pago', async () => {
    banco({ ...pendente(), status: 'PAID' });
    const res = await readApi(await aprovar());
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error?.code, 'ALREADY_PAID');
  });

  test('recusa motivo longo demais', async () => {
    banco(pendente());
    const res = await readApi(await aprovar({ reason: 'x'.repeat(501) }));
    assert.strictEqual(res.status, 400);
  });

  test('aprova, registra quem aprovou no ledger e credita a recarga', async () => {
    const gravado = banco(pendente({ type: 'wallet_topup' }));

    const res = await readApi(await aprovar({ reason: 'comprovante conferido' }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(gravado.update.status, 'PAID');
    assert.strictEqual(gravado.update.metadata.forceApprovedBy, 's1');
    assert.strictEqual(gravado.ledger.type, 'ADJUSTMENT');
    assert.strictEqual(gravado.ledger.metadata.adminEmail, 'fin@empresa.com');
    assert.strictEqual(gravado.ledger.metadata.reason, 'comprovante conferido');
    const credito = (walletService.creditFromGatewayTopup as any).mock.calls[0].arguments[0];
    assert.deepStrictEqual(
      { userId: credito.userId, amountCents: credito.amountCents, paymentTransactionId: credito.paymentTransactionId },
      { userId: 'u1', amountCents: 5000, paymentTransactionId: 't1' }
    );
    assert.strictEqual(res.data.audit.approvedBy, 'fin@empresa.com');
  });

  test('sem corpo usa o motivo padrão e não credita pagamento que não é recarga', async () => {
    const gravado = banco(pendente({ type: 'checkout_payment' }));

    const res = await readApi(await aprovar());

    assert.strictEqual(res.status, 200);
    assert.strictEqual(gravado.ledger.metadata.reason, 'Aprovação manual administrativa');
    assert.strictEqual((walletService.creditFromGatewayTopup as any).mock.callCount(), 0);
  });
});
