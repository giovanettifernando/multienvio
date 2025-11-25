import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { POST } from '../../../../../../../app/api/admin/payment-transactions/sync/route.ts';

function makeRequest(body: unknown) {
  return new Request('http://test/api/admin/payment-transactions/sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

test.describe('app/api/admin/payment-transactions/sync', () => {
  let adminHelpers: any;
  let paymentsModule: any;

  test.before(async () => {
    adminHelpers = await import('../../../../../../../lib/auth/admin-helpers.ts');
    paymentsModule = await import('../../../../../../../lib/mercadopago/payments.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('retorna resposta de auth quando requireAdminUser bloqueia', async () => {
    test.mock.method(
      adminHelpers,
      'requireAdminUser',
      async () => NextResponse.json({ message: 'sem auth' }, { status: 401 })
    );

    const res = await POST(makeRequest({ externalId: 'ext' }));
    assert.strictEqual(res.status, 401);
  });

  test('retorna 400 quando externalId ausente', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));

    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 400);
  });

  test('sincroniza pagamento com sucesso', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    test.mock.method(paymentsModule, 'updatePaymentFromMercadoPago', async () => ({
      id: 't1',
      status: 'PAID',
      externalId: 'ext',
      amountCents: 2000,
    }));

    const res = await POST(makeRequest({ externalId: 'ext' }));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.transaction.id, 't1');
    assert.strictEqual(body.transaction.status, 'PAID');
  });

  test('retorna 500 quando sincronização falha', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    test.mock.method(paymentsModule, 'updatePaymentFromMercadoPago', async () => {
      throw new Error('mp down');
    });

    const res = await POST(makeRequest({ externalId: 'ext' }));
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.error.includes('mp down'));
  });

  test('retorna 400 para JSON inválido', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    const badReq = new Request('http://test/api/admin/payment-transactions/sync', {
      method: 'POST',
      body: '{invalid',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(badReq);
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
  });

  test('propaga mensagem específica de erro do updatePaymentFromMercadoPago', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    test.mock.method(paymentsModule, 'updatePaymentFromMercadoPago', async () => {
      throw new Error('transação não encontrada');
    });

    const res = await POST(makeRequest({ externalId: 'missing' }));
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.error.includes('transação não encontrada'));
  });
});
