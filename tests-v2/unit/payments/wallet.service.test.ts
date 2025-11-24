import { describe, it, strictEqual, rejects, deepStrictEqual, afterEach } from 'node:test';
import { mock } from 'node:test';
import { creditFromGatewayTopup, debit, manualCredit } from '@/lib/wallet/wallet.service';
import { prisma } from '@/lib/db';
import { fakePaymentTransaction, fakeWallet } from '../../_fixtures/factories';
import { resetAllMocks } from '../../_setup/test-helpers';

describe('wallet.service', () => {
  it('valida PaymentTransaction e aplica crédito quando PAID', async () => {
    const paymentTx = fakePaymentTransaction({ status: 'PAID', id: 'ptx-1', referenceId: 'ref-1' });
    const wallet = fakeWallet({ userId: 'user-1', availableCents: 0 });
    const createdWalletTx = { id: 'wtx-1', type: 'TOPUP', status: 'CONFIRMED', amountCents: 5000, title: 'Recarga', referenceId: 'ref-1', meta: {}, createdAt: new Date(), confirmedAt: new Date() };
    const updatedWallet = { ...wallet, availableCents: 5000 };

    mock.method(prisma.paymentTransaction, 'findUnique', async () => paymentTx as any);
    mock.method(prisma.walletTransaction, 'findFirst', async () => null as any);
    mock.method(prisma.wallet, 'findUnique', async () => wallet as any);
    mock.method(prisma.walletTransaction, 'create', async () => createdWalletTx as any);
    mock.method(prisma.wallet, 'update', async () => updatedWallet as any);
    mock.method(prisma, '$transaction', async () => [createdWalletTx, updatedWallet]);

    const result = await creditFromGatewayTopup({
      userId: 'user-1',
      amountCents: 5000,
      paymentTransactionId: 'ptx-1',
      providerPaymentId: 'ext-1',
    });

    strictEqual(result.amountCents, 5000);
    strictEqual(result.id, 'wtx-1');
  });

  it('impede crédito duplicado com meta.paymentTransactionId', async () => {
    const existing = { id: 'wtx-dup', type: 'TOPUP', status: 'CONFIRMED', amountCents: 5000, title: 'Recarga', referenceId: 'ref', createdAt: new Date(), confirmedAt: new Date() };
    mock.method(prisma.paymentTransaction, 'findUnique', async () => fakePaymentTransaction({ status: 'PAID' }) as any);
    mock.method(prisma.walletTransaction, 'findFirst', async () => existing as any);

    const result = await creditFromGatewayTopup({
      userId: 'user-1',
      amountCents: 5000,
      paymentTransactionId: 'ptx-1',
    });

    strictEqual(result.id, 'wtx-dup');
  });

  it('lança erro se PaymentTransaction não existe ou não está PAID', async () => {
    mock.method(prisma.paymentTransaction, 'findUnique', async () => null as any);
    await rejects(
      creditFromGatewayTopup({ userId: 'u', amountCents: 100, paymentTransactionId: 'missing' }),
      /não encontrada/i
    );

    mock.method(prisma.paymentTransaction, 'findUnique', async () => fakePaymentTransaction({ status: 'PENDING' }) as any);
    await rejects(
      creditFromGatewayTopup({ userId: 'u', amountCents: 100, paymentTransactionId: 'ptx' }),
      /não está PAID/i
    );
  });

  it('debit valida saldo e valor positivo', async () => {
    const wallet = fakeWallet({ availableCents: 1000 });
    const createdTx = { id: 'tx-debit', type: 'PURCHASE', status: 'CONFIRMED', amountCents: -500, title: 'Débito', referenceId: null, createdAt: new Date(), confirmedAt: new Date() };
    const updatedWallet = { ...wallet, availableCents: 500 };

    mock.method(prisma.wallet, 'findUnique', async () => wallet as any);
    mock.method(prisma.walletTransaction, 'create', async () => createdTx as any);
    mock.method(prisma.wallet, 'update', async () => updatedWallet as any);
    mock.method(prisma, '$transaction', async () => [createdTx, updatedWallet]);

    const result = await debit('user-1', 500, 'Compra', 'ref');
    strictEqual(result.amountCents, -500);
  });

  it('manualCredit cria crédito confirmado', async () => {
    const wallet = fakeWallet({ availableCents: 1000 });
    const createdTx = { id: 'tx-credit', type: 'TOPUP', status: 'CONFIRMED', amountCents: 800, title: 'Crédito manual', referenceId: null, meta: {}, createdAt: new Date(), confirmedAt: new Date() };
    const updatedWallet = { ...wallet, availableCents: 1800 };

    mock.method(prisma.wallet, 'findUnique', async () => wallet as any);
    mock.method(prisma.walletTransaction, 'create', async () => createdTx as any);
    mock.method(prisma.wallet, 'update', async () => updatedWallet as any);
    mock.method(prisma, '$transaction', async () => [createdTx, updatedWallet]);

    const result = await manualCredit({
      userId: wallet.userId as string,
      amountCents: 800,
      reason: 'ajuste',
      createdByAdminId: 'admin-1',
    });

    deepStrictEqual(result.amountCents, 800);
    strictEqual(result.id, 'tx-credit');
  });
});
afterEach(resetAllMocks);
