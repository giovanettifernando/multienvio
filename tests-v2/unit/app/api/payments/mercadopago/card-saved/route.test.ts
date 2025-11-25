import assert from 'node:assert';
import test from 'node:test';
import { POST } from '../../../../../../../app/api/payments/mercadopago/card-saved/route.ts';
import { prisma } from '../../../../../../../lib/db.ts';

let sessionModule: any;
let cardsModule: any;
const originalPrisma = {
  card: prisma.card,
  paymentGateway: (prisma as any).paymentGateway,
  paymentTransaction: (prisma as any).paymentTransaction,
};

function makeRequest(body: unknown) {
  return new Request('http://test/api/payments/mercadopago/card-saved', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

test.describe('app/api/payments/mercadopago/card-saved', () => {
  test.before(async () => {
    sessionModule = await import('../../../../../../../lib/auth/session.ts');
    cardsModule = await import('../../../../../../../lib/mercadopago/cards.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.card = originalPrisma.card;
    prisma.paymentGateway = originalPrisma.paymentGateway;
    prisma.paymentTransaction = originalPrisma.paymentTransaction;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => null);
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 401);
  });

  test('retorna 400 em payload inválido', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    const res = await POST(makeRequest({ cardId: '' }));
    assert.strictEqual(res.status, 400);
  });

  test('retorna 404 se cartão não encontrado', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.card = { findUnique: async () => null } as any;
    const res = await POST(makeRequest({
      cardId: 'c1',
      token: 't',
      transactionAmount: 10,
      paymentMethodId: 'visa',
      payer: { email: 'a@b.com' },
    }));
    assert.strictEqual(res.status, 404);
  });

  test('retorna 403 se cartão não pertence ao usuário', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.card = { findUnique: async () => ({ id: 'c1', userId: 'other', mpCardId: 'mpc', user: {} }) } as any;
    const res = await POST(makeRequest({
      cardId: 'c1',
      token: 't',
      transactionAmount: 10,
      paymentMethodId: 'visa',
      payer: { email: 'a@b.com' },
    }));
    assert.strictEqual(res.status, 403);
  });

  test('cria pagamento com cartão salvo', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1', email: 'a@b.com' }));
    prisma.card = { findUnique: async () => ({ id: 'c1', userId: 'u1', mpCardId: 'mpc', brand: 'VISA', user: { email: 'a@b.com', mpCustomerId: 'cust1', name: 'User Test' } }) } as any;
    prisma.paymentGateway = { findFirst: async () => ({ id: 'g1', status: 'ACTIVE' }) } as any;
    prisma.paymentTransaction = { create: async ({ data }: any) => ({ id: 't1', ...data }) } as any;
    test.mock.method(cardsModule, 'createPaymentWithSavedCard', async () => ({ id: 'p1', status: 'approved', status_detail: 'approved' }));

    const res = await POST(makeRequest({
      cardId: 'c1',
      token: 't',
      transactionAmount: 10,
      paymentMethodId: 'visa',
      payer: { email: 'a@b.com' },
    }));
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.payment.id, 'p1');
  });
});
