import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/wallet/statement/download/route';
import { prisma } from '@/platform/db/db';

let sessionModule: any;
let periodModule: any;
let directionModule: any;
let puppeteerModule: any;
const originalPrisma = { user: prisma.user, wallet: prisma.wallet, walletTransaction: prisma.walletTransaction };

function makeRequest(url: string) {
  return new Request(url);
}

test.describe('app/api/wallet/statement/download', () => {
  test.before(async () => {
    sessionModule = await import('../../../../../../../modules/auth/application/session.ts');
    periodModule = await import('../../../../../../../modules/wallet/application/period-summary.ts');
    directionModule = await import('../../../../../../../modules/wallet/application/transaction-direction.ts');
    puppeteerModule = await import('puppeteer');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalPrisma.user;
    prisma.wallet = originalPrisma.wallet;
    prisma.walletTransaction = originalPrisma.walletTransaction;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => null);
    const res = await GET(makeRequest('http://test/api/wallet/statement/download'));
    assert.strictEqual(res.status, 401);
  });

  test('gera PDF quando autenticado', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.user = { findUnique: async () => ({ id: 'u1', name: 'User', email: 'a@b.com' }) } as any;
    prisma.wallet = { findUnique: async () => ({ id: 'w1' }) } as any;
    prisma.walletTransaction = { findMany: async () => [] } as any;
    test.mock.method(periodModule, 'getLastNDaysRange', () => ({ start: new Date('2024-01-01'), end: new Date('2024-01-31') }));
    test.mock.method(periodModule, 'calculatePeriodSummary', () => ({ credits: 0, debits: 0, total: 0 }));
    test.mock.method(directionModule, 'getTransactionDirection', () => 'credit');
    test.mock.method(directionModule, 'getTransactionTypeLabel', () => 'Depósito');
    test.mock.method(directionModule, 'formatTransactionAmount', () => '+ R$ 0,00');

    const pdfBuffer = Buffer.from('pdf');
    const pageMock = { setContent: async () => {}, pdf: async () => pdfBuffer, close: async () => {} };
    const browserMock = { newPage: async () => pageMock, close: async () => {} };
    const puppeteerTarget = puppeteerModule.default ?? puppeteerModule;
    test.mock.method(puppeteerTarget, 'launch', async () => browserMock as any);

    const res = await GET(makeRequest('http://test/api/wallet/statement/download'));
    assert.strictEqual(res.status, 200);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.equals(pdfBuffer));
  });
});
