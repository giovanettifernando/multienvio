import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/payments/[id]/refund/route';
import * as sessionModule from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import * as asaas from '@/platform/integrations/asaas';

function makeRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    nextUrl: new URL(url),
    json: () => req.json(),
  } as any;
}

function baseTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    externalId: 'pay_ext_1',
    userId: 'u1',
    amountCents: 5000,
    status: 'CAPTURED',
    metadata: null,
    gateway: { slug: 'asaas' },
    ...overrides,
  };
}

test.describe('app/api/payments/[id]/refund', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  // Regressão do concern #1 (Task 11 fix round 1): cartão aprovado no Asaas
  // vira CAPTURED (não AUTHORIZED, que o Pagar.me usava) e o Asaas permite
  // estornar cobranças confirmadas sem esperar a liquidação (PAID).
  test('estorna transação com status CAPTURED', async () => {
    test.mock.method(sessionModule, 'requireUserSession', async () => ({ userId: 'u1', role: 'ADMIN' }));
    test.mock.method(prisma.paymentTransaction, 'findUnique', async () => baseTransaction({ status: 'CAPTURED' }));
    test.mock.method(prisma.paymentTransaction, 'update', async ({ data }: any) => ({ id: 't1', ...data }));
    test.mock.method(asaas, 'refundCharge', async () => ({ id: 'pay_ext_1', status: 'CONFIRMED' }));

    const res = await POST(
      makeRequest('http://test/api/payments/t1/refund', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }),
      { params: Promise.resolve({ id: 't1' }) } as any,
    );

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.success, true);
    assert.strictEqual(body.data.transaction.status, 'CAPTURED');
  });

  test('não estorna transação com status PENDING', async () => {
    test.mock.method(sessionModule, 'requireUserSession', async () => ({ userId: 'u1', role: 'ADMIN' }));
    test.mock.method(prisma.paymentTransaction, 'findUnique', async () => baseTransaction({ status: 'PENDING' }));
    let refundCalled = false;
    test.mock.method(asaas, 'refundCharge', async () => {
      refundCalled = true;
      return { id: 'pay_ext_1', status: 'CONFIRMED' };
    });

    const res = await POST(
      makeRequest('http://test/api/payments/t1/refund', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }),
      { params: Promise.resolve({ id: 't1' }) } as any,
    );

    assert.strictEqual(res.status, 400);
    assert.strictEqual(refundCalled, false);
  });
});
