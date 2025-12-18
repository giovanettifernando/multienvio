import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/payments/mercadopago/create/route';

let sessionModule: any;
let paymentsModule: any;
const originalEnv = { ...process.env };

function makeRequest(body: unknown) {
  return new Request('http://test/api/payments/mercadopago/create', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

test.describe('app/api/payments/mercadopago/create', () => {
  test.before(async () => {
    sessionModule = await import('../../../../../../../lib/auth/session.ts');
    paymentsModule = await import('../../../../../../../lib/mercadopago/payments.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    process.env = { ...originalEnv };
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => null);
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 401);
  });

  test('valida payload e retorna 400 em caso de erro', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    const res = await POST(makeRequest({ paymentMethodId: '' }));
    assert.strictEqual(res.status, 400);
  });

  test('cria pagamento quando payload válido', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1', email: 'a@b.com' }));
    test.mock.method(paymentsModule, 'createPaymentWithTracking', async () => ({
      preferenceId: 'pref',
      paymentId: 'pay1',
      redirectUrl: 'http://pay',
      transaction: {
        id: 'tx1',
        referenceId: 'ref1',
        status: 'PENDING',
        amountCents: 10000,
        method: 'PIX',
      },
      paymentData: {
        id: 'mp1',
        status: 'pending',
        status_detail: 'pending_waiting_payment',
        point_of_interaction: { transaction_data: { qr_code: 'q', qr_code_base64: 'b64' } },
      },
    }));

    const res = await POST(
      makeRequest({
        transactionAmount: 100,
        paymentMethodId: 'pix',
        payer: { email: 'a@b.com' },
        metadata: { type: 'wallet_topup', walletId: 'w1' },
      }),
    );
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.transaction.id, 'tx1');
  });
});
