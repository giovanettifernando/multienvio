import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../../../../../app/api/wallet/route.ts';
import { prisma } from '../../../../../lib/db.ts';

let sessionModule: any;
let walletService: any;
let periodModule: any;
let directionModule: any;
const originalPrisma = { walletTransaction: prisma.walletTransaction };

test.describe('app/api/wallet/route', () => {
  test.before(async () => {
    sessionModule = await import('../../../../../lib/auth/session.ts');
    walletService = await import('../../../../../lib/wallet/wallet.service.ts');
    periodModule = await import('../../../../../lib/wallet/period-summary.ts');
    directionModule = await import('../../../../../lib/wallet/transaction-direction.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.walletTransaction = originalPrisma.walletTransaction;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => null);
    const res = await GET();
    assert.strictEqual(res.status, 401);
  });

  test('retorna saldo com transações formatadas', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    test.mock.method(walletService, 'getOrCreateWallet', async () => ({
      id: 'w1',
      availableCents: 1000,
      pendingCents: 0,
    }));
    test.mock.method(periodModule, 'getCurrentMonthRange', () => ({
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    }));
    test.mock.method(periodModule, 'calculatePeriodSummary', () => ({ total: 10, credits: 10, debits: 0 }));
    test.mock.method(directionModule, 'getTransactionDirection', () => 'credit');
    test.mock.method(directionModule, 'getTransactionTypeLabel', () => 'Depósito');
    test.mock.method(directionModule, 'formatTransactionAmount', () => '+ R$ 10,00');

    const tx = { id: 'tx1', type: 'deposit', status: 'CONFIRMED', amountCents: 1000, title: 'depósito', referenceId: null, createdAt: new Date(), confirmedAt: new Date() };
    prisma.walletTransaction = { findMany: async () => [tx] } as any;

    const res = await GET();
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.balance.availableReais, 10);
    assert.strictEqual(body.latestTransactions[0].id, 'tx1');
  });
});
