import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/wallet/transactions/route';
import { prisma } from '@/platform/db/db';

let sessionModule: any;
let periodModule: any;
let directionModule: any;
const originalPrisma = { wallet: prisma.wallet, walletTransaction: prisma.walletTransaction };

function makeRequest(url: string) {
  return new Request(url);
}

test.describe('app/api/wallet/transactions', () => {
  test.before(async () => {
    sessionModule = await import('../../../../../../lib/auth/session.ts');
    periodModule = await import('../../../../../../lib/wallet/period-summary.ts');
    directionModule = await import('../../../../../../lib/wallet/transaction-direction.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.wallet = originalPrisma.wallet;
    prisma.walletTransaction = originalPrisma.walletTransaction;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => null);
    const res = await GET(makeRequest('http://test/api/wallet/transactions'));
    assert.strictEqual(res.status, 401);
  });

  test('retorna 404 se carteira não encontrada', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.wallet = { findUnique: async () => null } as any;
    const res = await GET(makeRequest('http://test/api/wallet/transactions'));
    assert.strictEqual(res.status, 404);
  });

  test('lista transações com paginação', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.wallet = { findUnique: async () => ({ id: 'w1' }) } as any;
    test.mock.method(periodModule, 'getLastNDaysRange', () => ({ start: new Date('2024-01-01'), end: new Date('2024-01-31') }));
    test.mock.method(directionModule, 'getTransactionDirection', () => 'credit');
    test.mock.method(directionModule, 'getTransactionTypeLabel', () => 'Depósito');
    test.mock.method(directionModule, 'formatTransactionAmount', () => '+ R$ 10,00');

    prisma.walletTransaction = {
      count: async () => 1,
      findMany: async () => [
        { id: 'tx1', type: 'TOPUP', status: 'CONFIRMED', amountCents: 1000, title: 'dep', referenceId: 'ref', createdAt: new Date(), confirmedAt: new Date() },
      ],
      aggregate: async (args: any) => {
        const isCreditAgg = args?.where?.OR?.some((cond: any) => cond.type === 'TOPUP');
        if (isCreditAgg) {
          return { _sum: { amountCents: 1000 }, _count: 1 };
        }
        return { _sum: { amountCents: -500 }, _count: 1 };
      },
    } as any;

    const res = await GET(makeRequest('http://test/api/wallet/transactions?page=1&limit=10'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.page, 1);
    assert.strictEqual(body.transactions[0].id, 'tx1');
    assert.strictEqual(body.summary.totalCredits, 10);
    assert.strictEqual(body.summary.totalDebits, 5);
    assert.strictEqual(body.summary.netAmount, 5);
    assert.strictEqual(body.pagination.total, 1);
    assert.strictEqual(body.pagination.hasMore, false);
  });
});
