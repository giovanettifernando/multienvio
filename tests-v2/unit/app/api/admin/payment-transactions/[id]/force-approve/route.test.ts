import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { POST } from '../../../../../../../../app/api/admin/payment-transactions/[id]/force-approve/route.ts';
import { prisma } from '../../../../../../../../lib/db.ts';

const originalPaymentTransaction = prisma.paymentTransaction;

function makeRequest() {
  return new Request('http://test/api/admin/payment-transactions/p1/force-approve', {
    method: 'POST',
  });
}

test.describe('app/api/admin/payment-transactions/[id]/force-approve', () => {
  let adminHelpers: any;
  let walletService: any;

  test.before(async () => {
    adminHelpers = await import('../../../../../../../../lib/auth/admin-helpers.ts');
    walletService = await import('../../../../../../../../lib/wallet/wallet.service.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.paymentTransaction = originalPaymentTransaction;
  });

  test('retorna resposta de auth quando requireAdminUser bloqueia', async () => {
    test.mock.method(
      adminHelpers,
      'requireAdminUser',
      async () => NextResponse.json({ message: 'sem auth' }, { status: 401 })
    );

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'p1' }) } as any);
    assert.strictEqual(res.status, 401);
  });

  test('retorna 404 quando pagamento não existe', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentTransaction = { findUnique: async () => null } as any;

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'p1' }) } as any);
    assert.strictEqual(res.status, 404);
  });

  test('retorna 400 quando já pago', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentTransaction = {
      findUnique: async () => ({ id: 'p1', status: 'PAID' }),
    } as any;

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'p1' }) } as any);
    assert.strictEqual(res.status, 400);
  });

  test('aprova manualmente e credita carteira se wallet_topup', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentTransaction = {
      findUnique: async () => ({
        id: 'p1',
        status: 'PENDING',
        metadata: { type: 'wallet_topup', currency: 'BRL' },
        amountCents: 5000,
        userId: 'u1',
        externalId: 'ext1',
      }),
      update: async ({ where }: any) => ({
        id: where.id,
        status: 'PAID',
        amountCents: 5000,
        userId: 'u1',
        metadata: { type: 'wallet_topup', currency: 'BRL' },
        externalId: 'ext1',
        paidAt: new Date('2024-01-01'),
      }),
    } as any;
    const creditSpy = test.mock.method(walletService, 'creditFromGatewayTopup', async () => undefined);

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'p1' }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.transaction.status, 'PAID');
    assert.strictEqual(creditSpy.mock.callCount(), 1);
  });
});
