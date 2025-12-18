import assert from 'node:assert';
import test from 'node:test';
import { createPaymentWithTracking, updatePaymentFromMercadoPago } from '@/lib/mercadopago/payments';
import { prisma } from '@/platform/db/db';
import * as client from '@/lib/mercadopago/client';
import * as walletService from '@/modules/wallet/application/wallet.service';

type PrismaLike = typeof prisma;

function backupPrisma() {
  return {
    paymentGateway: prisma.paymentGateway,
    paymentTransaction: prisma.paymentTransaction,
    wallet: prisma.wallet,
    walletTransaction: prisma.walletTransaction,
    shipment: prisma.shipment,
    label: prisma.label,
    $transaction: prisma.$transaction,
  } satisfies Partial<PrismaLike>;
}

function restorePrisma(snapshot: ReturnType<typeof backupPrisma>) {
  prisma.paymentGateway = snapshot.paymentGateway;
  prisma.paymentTransaction = snapshot.paymentTransaction;
  prisma.wallet = snapshot.wallet;
  prisma.walletTransaction = snapshot.walletTransaction;
  prisma.shipment = snapshot.shipment;
  prisma.label = snapshot.label;
  prisma.$transaction = snapshot.$transaction;
}

const originalClient = {
  createPayment: client.createPayment,
  getPaymentById: client.getPaymentById,
  processPaymentData: client.processPaymentData,
};

const originalWallet = {
  creditFromGatewayTopup: walletService.creditFromGatewayTopup,
};

test.describe('mercadopago payments', () => {
  const prismaInitial = backupPrisma();

  test.afterEach(() => {
    restorePrisma(prismaInitial);
    client.createPayment = originalClient.createPayment;
    client.getPaymentById = originalClient.getPaymentById;
    client.processPaymentData = originalClient.processPaymentData;
    walletService.creditFromGatewayTopup = originalWallet.creditFromGatewayTopup;
  });

  test('createPaymentWithTracking cria transação e aplica wallet_topup quando pago', async () => {
    const prismaSnapshot = backupPrisma();
    let creditCalled: { userId?: string; amountCents?: number; paymentTransactionId?: string } | null = null;

    prisma.paymentGateway = {
      findFirst: async () => ({ id: 'gw-1', slug: 'mercadopago', status: 'ACTIVE' } as any),
    } as any;

    prisma.paymentTransaction = {
      create: async ({ data }: any) => ({ id: 'tx-1', ...data }),
      update: async ({ data, where }: any) => ({ id: where.id, ...data, metadata: data.metadata ?? { type: 'wallet_topup', userId: 'u1' } }),
    } as any;

    prisma.$transaction = async (actions: any) => actions;

    client.createPayment = async () => ({ id: 'mp-1' } as any);
    client.processPaymentData = () =>
      ({
        externalId: 'mp-1',
        status: 'PAID',
        amountCents: 1000,
        feeCents: 100,
        netCents: 900,
        method: 'CREDIT_CARD',
      }) as any;

    walletService.creditFromGatewayTopup = async (params: any) => {
      creditCalled = params;
      return { id: 'wallet-tx', ...params };
    };

    const result = await createPaymentWithTracking({
      transactionAmount: 10,
      metadata: { type: 'wallet_topup', userId: 'u1' },
    } as any);

    assert.strictEqual(result.transaction.id, 'tx-1');
    assert.strictEqual(creditCalled?.userId, 'u1');
    assert.strictEqual(creditCalled?.amountCents, 1000);
    assert.strictEqual(creditCalled?.paymentTransactionId, 'tx-1');

    restorePrisma(prismaSnapshot);
  });

  test('updatePaymentFromMercadoPago atualiza transação existente e aplica wallet_topup', async () => {
    const prismaSnapshot = backupPrisma();
    let creditCalled = false;

    prisma.paymentTransaction = {
      findFirst: async () =>
        ({
          id: 'tx-2',
          status: 'PENDING',
          metadata: { type: 'wallet_topup', userId: 'user-2' },
        }) as any,
      // Retorna status pendente para acionar applyPaymentEffects no branch de atualização
      update: async ({ where }: any) => ({
        id: where.id,
        status: 'PENDING',
        metadata: { type: 'wallet_topup', userId: 'user-2' },
        amountCents: 2000,
      }),
    } as any;

    prisma.$transaction = async (actions: any) => actions;

    client.getPaymentById = async () => ({ id: 'mp-2' } as any);
    client.processPaymentData = () =>
      ({
        externalId: 'mp-2',
        status: 'PAID',
        amountCents: 2000,
        feeCents: 0,
        netCents: 2000,
        method: 'PIX',
      }) as any;

    walletService.creditFromGatewayTopup = async () => {
      creditCalled = true;
      return { id: 'wallet-tx-2' } as any;
    };

    const result = await updatePaymentFromMercadoPago('mp-2');

    assert.strictEqual(result.id, 'tx-2');
    assert.ok(creditCalled);

    restorePrisma(prismaSnapshot);
  });
});
