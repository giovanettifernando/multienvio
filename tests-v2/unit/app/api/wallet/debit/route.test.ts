import assert from 'node:assert';
import test from 'node:test';
import { POST } from '../../../../../../app/api/wallet/debit/route.ts';
import { prisma } from '../../../../../../lib/db.ts';

let sessionModule: any;
const originalPrisma = {
  shipment: prisma.shipment,
  wallet: prisma.wallet,
  walletTransaction: prisma.walletTransaction,
  ledgerEntry: (prisma as any).ledgerEntry,
  $transaction: prisma.$transaction,
};

function makeRequest(body: unknown) {
  return new Request('http://test/api/wallet/debit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

test.describe('app/api/wallet/debit', () => {
  test.before(async () => {
    sessionModule = await import('../../../../../../lib/auth/session.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.shipment = originalPrisma.shipment;
    prisma.wallet = originalPrisma.wallet;
    prisma.walletTransaction = originalPrisma.walletTransaction;
    (prisma as any).ledgerEntry = originalPrisma.ledgerEntry;
    prisma.$transaction = originalPrisma.$transaction;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => null);
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 401);
  });

  test('retorna 400 com payload inválido', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    const res = await POST(makeRequest({}));
    assert.strictEqual(res.status, 400);
  });

  test('retorna 404 quando shipment não existe', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.shipment = { findUnique: async () => null } as any;
    const res = await POST(makeRequest({ shipmentId: 's1', amount: 10 }));
    assert.strictEqual(res.status, 404);
  });

  test('retorna 200 idempotente quando transação já existe', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.shipment = { findUnique: async () => ({ id: 's1' }) } as any;
    const txMock = {
      walletTransaction: {
        findUnique: async () => ({ id: 'tx1' }),
      },
      wallet: {
        findUnique: async () => ({ id: 'w1', availableCents: 1000 }),
      },
    } as any;
    prisma.$transaction = async (fn: any) => fn(txMock);
    const res = await POST(makeRequest({ shipmentId: 's1', amount: 5 }));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.idempotent, true);
  });

  test('retorna 400 se saldo insuficiente', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    prisma.shipment = { findUnique: async () => ({ id: 's1' }) } as any;
    const txMock = {
      walletTransaction: { findUnique: async () => null, create: async () => ({ id: 'tx1' }) },
      wallet: {
        findUnique: async () => ({ id: 'w1', availableCents: 100, pendingCents: 0 }),
        update: async () => ({}),
      },
      ledgerEntry: { create: async () => ({}) },
      shipment: { findMany: async () => [] },
      shipmentLabel: { createMany: async () => ({ count: 0 }) },
    } as any;
    prisma.$transaction = async (fn: any) => {
      await fn(txMock);
    };
    const res = await POST(makeRequest({ shipmentId: 's1', amount: 5 }));
    assert.strictEqual(res.status, 400);
  });
});
