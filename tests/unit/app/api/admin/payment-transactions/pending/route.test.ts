import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/admin/payment-transactions/pending/route';
import { prisma } from '@/platform/db/db';

const originalPaymentTransaction = prisma.paymentTransaction;

function makeRequest() {
  return {
    method: 'GET',
    headers: new Headers(),
    nextUrl: new URL('http://test/api/admin/payment-transactions/pending'),
  } as any;
}

test.describe('app/api/admin/payment-transactions/pending', () => {
  let adminHelpers: any;

  test.before(async () => {
    adminHelpers = await import('../../../../../../../modules/auth/application/admin-helpers.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.paymentTransaction = originalPaymentTransaction;
  });

  test('retorna resposta de auth quando requireAdminUser bloqueia', async () => {
    test.mock.method(
      adminHelpers,
      'requireAdminUser',
      async () => NextResponse.json({ message: 'não' }, { status: 401 })
    );

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 401);
  });

  test('retorna 500 se prisma falhar', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentTransaction = {
      findMany: async () => {
        throw new Error('db error');
      },
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 500);
  });

  test('lista pagamentos pendentes com sucesso', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentTransaction = {
      findMany: async () => [
        {
          id: 'p1',
          status: 'PENDING',
          user: { name: 'Ana', email: 'ana@test.com' },
          createdAt: new Date(),
        },
      ],
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.total, 1);
    assert.strictEqual(body.payments[0].id, 'p1');
    assert.strictEqual(body.payments[0].user.name, 'Ana');
  });

  test('limita a 100 registros e ordena por createdAt desc', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentTransaction = {
      findMany: async (args: any) => {
        assert.strictEqual(args.take, 100);
        assert.deepStrictEqual(args.orderBy, { createdAt: 'desc' });
        return Array.from({ length: 120 }, (_, i) => ({
          id: `p${i}`,
          status: 'PENDING',
          user: { name: `N${i}`, email: `e${i}@t.com` },
        })).slice(0, 100);
      },
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.total, 100);
    assert.strictEqual(body.payments.length, 100);
    assert.strictEqual(body.payments[0].id, 'p0');
  });
});
