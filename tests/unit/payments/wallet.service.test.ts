import { describe, it, beforeEach, afterEach } from 'node:test';
import { creditFromGatewayTopup, debit, manualCredit } from '@/modules/wallet/application/wallet.service';
import { prisma } from '@/platform/db/db';
import { fakePaymentTransaction, fakeWallet } from '../../_fixtures/factories';
import { resetAllMocks } from '../../_setup/test-helpers';
import assert from 'node:assert/strict';

let originalPaymentTransaction: typeof prisma.paymentTransaction;
let originalWalletTransaction: typeof prisma.walletTransaction;
let originalWallet: typeof prisma.wallet;
let originalTransaction: typeof prisma.$transaction;

beforeEach(() => {
  originalPaymentTransaction = prisma.paymentTransaction;
  originalWalletTransaction = prisma.walletTransaction;
  originalWallet = prisma.wallet;
  originalTransaction = prisma.$transaction;
});

afterEach(() => {
  prisma.paymentTransaction = originalPaymentTransaction;
  prisma.walletTransaction = originalWalletTransaction;
  prisma.wallet = originalWallet;
  prisma.$transaction = originalTransaction;
  resetAllMocks();
});

function stubPrismaDelegates(stubs: {
  paymentTransaction?: Partial<typeof prisma.paymentTransaction>;
  walletTransaction?: Partial<typeof prisma.walletTransaction>;
  wallet?: Partial<typeof prisma.wallet>;
  transactionResult?: unknown[];
}) {
  if (stubs.paymentTransaction) {
    prisma.paymentTransaction = {
      findUnique: async () => undefined,
      findFirst: async () => undefined,
      ...stubs.paymentTransaction,
    } as any;
  }

  if (stubs.walletTransaction) {
    prisma.walletTransaction = {
      findFirst: async () => undefined,
      create: async () => undefined,
      update: async () => undefined,
      ...stubs.walletTransaction,
    } as any;
  }

  if (stubs.wallet) {
    prisma.wallet = {
      findUnique: async () => undefined,
      create: async () => undefined,
      update: async () => undefined,
      ...stubs.wallet,
    } as any;
  }

  if (stubs.transactionResult) {
    prisma.$transaction = async () => stubs.transactionResult as any;
  } else {
    prisma.$transaction = async (actions: unknown) => actions as any;
  }
}

describe('wallet.service', () => {
  it('valida PaymentTransaction e aplica crédito quando PAID', async () => {
    const paymentTx = fakePaymentTransaction({ status: 'PAID', id: 'ptx-1', referenceId: 'ref-1' });
    const wallet = fakeWallet({ userId: 'user-1', availableCents: 0 });
    const createdWalletTx = { id: 'wtx-1', type: 'TOPUP', status: 'CONFIRMED', amountCents: 5000, title: 'Recarga', referenceId: 'ref-1', meta: {}, createdAt: new Date(), confirmedAt: new Date() };
    const updatedWallet = { ...wallet, availableCents: 5000 };

    stubPrismaDelegates({
      paymentTransaction: {
        findUnique: async () => paymentTx as any,
      },
      walletTransaction: {
        findFirst: async () => null as any,
        create: async () => createdWalletTx as any,
      },
      wallet: {
        findUnique: async () => wallet as any,
        update: async () => updatedWallet as any,
      },
      transactionResult: [createdWalletTx, updatedWallet],
    });

    const result = await creditFromGatewayTopup({
      userId: 'user-1',
      amountCents: 5000,
      paymentTransactionId: 'ptx-1',
      providerPaymentId: 'ext-1',
    });

    assert.strictEqual(result.amountCents, 5000);
    assert.strictEqual(result.id, 'wtx-1');
  });

  it('impede crédito duplicado com meta.paymentTransactionId', async () => {
    const existing = { id: 'wtx-dup', type: 'TOPUP', status: 'CONFIRMED', amountCents: 5000, title: 'Recarga', referenceId: 'ref', createdAt: new Date(), confirmedAt: new Date() };
    stubPrismaDelegates({
      paymentTransaction: {
        findUnique: async () => fakePaymentTransaction({ status: 'PAID' }) as any,
      },
      walletTransaction: {
        findFirst: async () => existing as any,
      },
    });

    const result = await creditFromGatewayTopup({
      userId: 'user-1',
      amountCents: 5000,
      paymentTransactionId: 'ptx-1',
    });

    assert.strictEqual(result.id, 'wtx-dup');
  });

  it('lança erro se PaymentTransaction não existe ou não está PAID', async () => {
    stubPrismaDelegates({
      paymentTransaction: {
        findUnique: async () => null as any,
      },
    });
    await assert.rejects(
      creditFromGatewayTopup({ userId: 'u', amountCents: 100, paymentTransactionId: 'missing' }),
      /não encontrada/i
    );

    stubPrismaDelegates({
      paymentTransaction: {
        findUnique: async () => fakePaymentTransaction({ status: 'PENDING' }) as any,
      },
    });
    await assert.rejects(
      creditFromGatewayTopup({ userId: 'u', amountCents: 100, paymentTransactionId: 'ptx' }),
      /não está PAID/i
    );
  });

  it('debit valida saldo e valor positivo', async () => {
    const wallet = fakeWallet({ availableCents: 1000 });
    const createdTx = { id: 'tx-debit', type: 'PURCHASE', status: 'CONFIRMED', amountCents: -500, title: 'Débito', referenceId: null, createdAt: new Date(), confirmedAt: new Date() };
    const updatedWallet = { ...wallet, availableCents: 500 };

    stubPrismaDelegates({
      wallet: {
        findUnique: async () => wallet as any,
        update: async () => updatedWallet as any,
      },
      walletTransaction: {
        create: async () => createdTx as any,
      },
      transactionResult: [createdTx, updatedWallet],
    });

    const result = await debit('user-1', 500, 'Compra', 'ref');
    assert.strictEqual(result.amountCents, -500);
  });

  it('manualCredit cria crédito confirmado', async () => {
    const wallet = fakeWallet({ availableCents: 1000 });
    const createdTx = { id: 'tx-credit', type: 'TOPUP', status: 'CONFIRMED', amountCents: 800, title: 'Crédito manual', referenceId: null, meta: {}, createdAt: new Date(), confirmedAt: new Date() };
    const updatedWallet = { ...wallet, availableCents: 1800 };

    stubPrismaDelegates({
      wallet: {
        findUnique: async () => wallet as any,
        update: async () => updatedWallet as any,
      },
      walletTransaction: {
        create: async () => createdTx as any,
      },
      transactionResult: [createdTx, updatedWallet],
    });

    const result = await manualCredit({
      userId: wallet.userId as string,
      amountCents: 800,
      reason: 'ajuste',
      createdByAdminId: 'admin-1',
    });

    assert.deepStrictEqual(result.amountCents, 800);
    assert.strictEqual(result.id, 'tx-credit');
  });
});
