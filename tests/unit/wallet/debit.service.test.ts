/**
 * Wallet Debit Service Tests
 *
 * Testes rigorosos para o serviço de débito de carteira.
 * Cobre: conversões monetárias, idempotência, race conditions,
 * saldo insuficiente, transações atômicas, e fluxos completos.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@/platform/api/errors';
import {
  processDebit,
  toCents,
  toReais,
  generateTransactionTitle,
  buildReferenceId,
  validateBalance,
  DebitErrorCodes,
  type DebitInput,
  type DebitServiceDeps,
} from '@/modules/wallet/application/debit.service';

// =============================================================================
// Test Helpers
// =============================================================================

interface MockPrismaOverrides {
  shipment?: {
    findUnique?: (args: any) => Promise<any>;
    findMany?: (args: any) => Promise<any[]>;
    update?: (args: any) => Promise<any>;
  };
  walletTransaction?: {
    findUnique?: (args: any) => Promise<any>;
    create?: (args: any) => Promise<any>;
  };
  wallet?: {
    findUnique?: (args: any) => Promise<any>;
    update?: (args: any) => Promise<any>;
  };
  ledgerEntry?: {
    create?: (args: any) => Promise<any>;
  };
  label?: {
    findMany?: (args: any) => Promise<any[]>;
    updateMany?: (args: any) => Promise<any>;
  };
  cart?: {
    findFirst?: (args: any) => Promise<any>;
    update?: (args: any) => Promise<any>;
  };
  cartItem?: {
    deleteMany?: (args: any) => Promise<any>;
  };
  $queryRaw?: (query: any) => Promise<any>;
  $transaction?: (fn: (tx: any) => Promise<any>) => Promise<any>;
}

function makeMockPrisma(overrides: MockPrismaOverrides = {}): any {
  const defaultWallet = {
    id: 'wallet-1',
    userId: 'user-1',
    availableCents: 100000, // R$1000,00
    pendingCents: 0,
  };

  const defaultShipment = {
    id: 'ship-1',
    senderId: 'user-1',
    document: {},
  };

  // Build inner tx object
  const txMethods = {
    walletTransaction: {
      findUnique: overrides.walletTransaction?.findUnique ?? (async () => null),
      create: overrides.walletTransaction?.create ?? (async (args: any) => ({
        id: 'tx-new',
        ...args.data,
      })),
    },
    wallet: {
      findUnique: overrides.wallet?.findUnique ?? (async () => defaultWallet),
      update: overrides.wallet?.update ?? (async (args: any) => ({
        ...defaultWallet,
        availableCents: defaultWallet.availableCents - (args.data.availableCents?.decrement || 0),
      })),
    },
    shipment: {
      findUnique: overrides.shipment?.findUnique ?? (async () => defaultShipment),
      findMany: overrides.shipment?.findMany ?? (async () => [defaultShipment]),
      update: overrides.shipment?.update ?? (async () => defaultShipment),
    },
    ledgerEntry: {
      create: overrides.ledgerEntry?.create ?? (async () => ({ id: 'ledger-1' })),
    },
    label: {
      findMany: overrides.label?.findMany ?? (async () => []),
      updateMany: overrides.label?.updateMany ?? (async () => ({ count: 0 })),
    },
    cart: {
      findFirst: overrides.cart?.findFirst ?? (async () => null),
      update: overrides.cart?.update ?? (async () => ({})),
    },
    cartItem: {
      deleteMany: overrides.cartItem?.deleteMany ?? (async () => ({ count: 0 })),
    },
    $queryRaw: overrides.$queryRaw ?? (async () => [defaultWallet]),
  };

  return {
    ...txMethods,
    $transaction: overrides.$transaction ?? (async (fn: (tx: any) => Promise<any>) => fn(txMethods)),
  };
}

function makeDeps(prismaOverrides: MockPrismaOverrides = {}): DebitServiceDeps {
  return {
    prisma: makeMockPrisma(prismaOverrides),
    logger: undefined,
  };
}

// =============================================================================
// Pure Function Tests - Monetary Conversions
// =============================================================================

describe('debit.service - monetary conversions', () => {
  describe('toCents', () => {
    it('converts R$10.00 to 1000 cents', () => {
      assert.strictEqual(toCents(10), 1000);
    });

    it('converts R$0.01 to 1 cent', () => {
      assert.strictEqual(toCents(0.01), 1);
    });

    it('converts R$0 to 0 cents', () => {
      assert.strictEqual(toCents(0), 0);
    });

    it('handles fractional cents by rounding', () => {
      // R$10.999 should round to 1100 cents
      assert.strictEqual(toCents(10.999), 1100);
      // R$10.994 should round to 1099 cents
      assert.strictEqual(toCents(10.994), 1099);
    });

    it('handles large amounts correctly', () => {
      assert.strictEqual(toCents(999999.99), 99999999);
    });

    it('handles floating point precision issues', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const problematicValue = 0.1 + 0.2;
      assert.strictEqual(toCents(problematicValue), 30);
    });
  });

  describe('toReais', () => {
    it('converts 1000 cents to R$10.00', () => {
      assert.strictEqual(toReais(1000), 10);
    });

    it('converts 1 cent to R$0.01', () => {
      assert.strictEqual(toReais(1), 0.01);
    });

    it('converts 0 cents to R$0', () => {
      assert.strictEqual(toReais(0), 0);
    });

    it('handles large amounts correctly', () => {
      assert.strictEqual(toReais(99999999), 999999.99);
    });
  });

  describe('toCents and toReais are inverses', () => {
    const testValues = [0, 0.01, 1, 10, 100, 999.99, 12345.67];

    testValues.forEach((value) => {
      it(`roundtrip for R$${value}`, () => {
        const cents = toCents(value);
        const backToReais = toReais(cents);
        // Allow for rounding differences
        assert.ok(Math.abs(backToReais - value) < 0.01);
      });
    });
  });
});

// =============================================================================
// Pure Function Tests - Title Generation
// =============================================================================

describe('debit.service - generateTransactionTitle', () => {
  it('uses trackingCode when available', () => {
    const title = generateTransactionTitle({
      trackingCode: 'AB123456789BR',
      shipmentId: 'ship-1',
      reason: 'custom reason',
    });
    assert.strictEqual(title, 'Pagamento envio AB123456789BR');
  });

  it('uses shipmentId when trackingCode not available', () => {
    const title = generateTransactionTitle({
      shipmentId: 'ship-1',
      reason: 'custom reason',
    });
    assert.strictEqual(title, 'Pagamento envio ship-1');
  });

  it('uses reason when no tracking info available', () => {
    const title = generateTransactionTitle({
      reason: 'custom reason',
    });
    assert.strictEqual(title, 'Pagamento - custom reason');
  });

  it('uses default "compra" when nothing available', () => {
    const title = generateTransactionTitle({});
    assert.strictEqual(title, 'Pagamento - compra');
  });
});

// =============================================================================
// Pure Function Tests - Reference ID Building
// =============================================================================

describe('debit.service - buildReferenceId', () => {
  it('uses custom referenceId when provided', () => {
    const refId = buildReferenceId({
      customReferenceId: 'custom-ref-123',
      shipmentId: 'ship-1',
    });
    assert.strictEqual(refId, 'custom-ref-123');
  });

  it('builds from shipmentId when no custom provided', () => {
    const refId = buildReferenceId({
      shipmentId: 'ship-1',
    });
    assert.strictEqual(refId, 'shipment:ship-1');
  });

  it('returns undefined prefix when no shipmentId', () => {
    const refId = buildReferenceId({});
    assert.strictEqual(refId, 'shipment:undefined');
  });
});

// =============================================================================
// Pure Function Tests - Balance Validation
// =============================================================================

describe('debit.service - validateBalance', () => {
  it('does not throw when balance equals amount', () => {
    assert.doesNotThrow(() => {
      validateBalance(1000, 1000);
    });
  });

  it('does not throw when balance exceeds amount', () => {
    assert.doesNotThrow(() => {
      validateBalance(2000, 1000);
    });
  });

  it('throws INSUFFICIENT_FUNDS when balance is less than amount', () => {
    assert.throws(
      () => validateBalance(500, 1000),
      (err: any) => {
        assert.ok(err instanceof Error);
        assert.strictEqual(err.code, DebitErrorCodes.INSUFFICIENT_FUNDS);
        return true;
      }
    );
  });

  it('throws for 1 cent difference', () => {
    assert.throws(
      () => validateBalance(999, 1000),
      (err: any) => err.code === DebitErrorCodes.INSUFFICIENT_FUNDS
    );
  });

  it('allows zero amount debit', () => {
    assert.doesNotThrow(() => {
      validateBalance(1000, 0);
    });
  });
});

// =============================================================================
// Service Function Tests - processDebit
// =============================================================================

describe('debit.service - processDebit', () => {
  describe('successful debit', () => {
    it('debits wallet and returns correct balance', async () => {
      const initialBalance = 100000; // R$1000,00
      const debitAmount = 150; // R$150,00 = 15000 cents

      let walletUpdated = false;
      let transactionCreated = false;
      let ledgerCreated = false;

      const deps = makeDeps({
        $queryRaw: async () => [{ id: 'wallet-1', userId: 'user-1', availableCents: initialBalance, pendingCents: 0 }],
        wallet: {
          update: async (args: any) => {
            walletUpdated = true;
            const decrementAmount = args.data.availableCents?.decrement || 0;
            return { id: 'wallet-1', availableCents: initialBalance - decrementAmount };
          },
        },
        walletTransaction: {
          create: async (args: any) => {
            transactionCreated = true;
            return { id: 'tx-new', ...args.data };
          },
        },
        ledgerEntry: {
          create: async () => {
            ledgerCreated = true;
            return { id: 'ledger-1' };
          },
        },
      });

      const result = await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: debitAmount,
        },
        deps
      );

      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.idempotent, false);
      assert.strictEqual(result.balance, (initialBalance - toCents(debitAmount)) / 100);
      assert.ok(result.transactionId);
      assert.ok(walletUpdated);
      assert.ok(transactionCreated);
      assert.ok(ledgerCreated);
    });

    it('updates shipment payment info', async () => {
      let shipmentUpdateData: any = null;

      const deps = makeDeps({
        shipment: {
          findUnique: async () => ({ id: 'ship-1', senderId: 'user-1' }),
          findMany: async () => [{ id: 'ship-1', senderId: 'user-1', document: {} }],
          update: async (args: any) => {
            shipmentUpdateData = args.data;
            return { id: 'ship-1' };
          },
        },
      });

      await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: 100,
        },
        deps
      );

      assert.ok(shipmentUpdateData);
      assert.strictEqual(shipmentUpdateData.paymentMethod, 'WALLET');
      assert.strictEqual(shipmentUpdateData.document.payment.status, 'approved');
      assert.strictEqual(shipmentUpdateData.document.payment.method, 'wallet');
    });

    it('marks labels as issued after payment', async () => {
      let labelUpdateArgs: any = null;

      const deps = makeDeps({
        label: {
          findMany: async () => [
            { id: 'label-1', shipmentId: 'ship-1' },
            { id: 'label-2', shipmentId: 'ship-1' },
          ],
          updateMany: async (args: any) => {
            labelUpdateArgs = args;
            return { count: 2 };
          },
        },
      });

      await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: 100,
        },
        deps
      );

      assert.ok(labelUpdateArgs);
      assert.deepStrictEqual(labelUpdateArgs.where.id.in, ['label-1', 'label-2']);
      assert.strictEqual(labelUpdateArgs.data.status, 'issued');
    });
  });

  describe('idempotency', () => {
    it('returns existing transaction without re-debiting', async () => {
      const existingTransaction = {
        id: 'existing-tx',
        referenceId: 'shipment:ship-1',
        amountCents: 15000,
      };

      let debitCalled = false;

      const deps = makeDeps({
        walletTransaction: {
          findUnique: async () => existingTransaction,
        },
        wallet: {
          findUnique: async () => ({ id: 'wallet-1', availableCents: 85000 }),
          update: async () => {
            debitCalled = true;
            return {};
          },
        },
      });

      const result = await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: 150,
        },
        deps
      );

      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.idempotent, true);
      assert.strictEqual(result.transactionId, 'existing-tx');
      assert.strictEqual(result.message, 'Pagamento já processado anteriormente');
      assert.strictEqual(debitCalled, false);
    });

    it('uses custom referenceId for idempotency check', async () => {
      let queriedReferenceId: string | null = null;

      const deps = makeDeps({
        walletTransaction: {
          findUnique: async (args: any) => {
            queriedReferenceId = args.where.referenceId;
            return null;
          },
        },
      });

      await processDebit(
        {
          userId: 'user-1',
          referenceId: 'custom-checkout-123',
          amount: 100,
        },
        deps
      );

      assert.strictEqual(queriedReferenceId, 'custom-checkout-123');
    });
  });

  describe('error handling', () => {
    it('throws not_found for non-existent shipment', async () => {
      const deps = makeDeps({
        shipment: {
          findUnique: async () => null,
        },
      });

      await assert.rejects(
        () =>
          processDebit(
            {
              userId: 'user-1',
              shipmentId: 'non-existent',
              amount: 100,
            },
            deps
          ),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.code, 'not_found');
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });

    it('throws wallet_not_found when wallet missing', async () => {
      const deps = makeDeps({
        $queryRaw: async () => [], // No wallet found
      });

      await assert.rejects(
        () =>
          processDebit(
            {
              userId: 'user-without-wallet',
              amount: 100,
            },
            deps
          ),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.code, 'wallet_not_found');
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });

    it('throws insufficient_funds when balance too low', async () => {
      const deps = makeDeps({
        $queryRaw: async () => [{ id: 'wallet-1', userId: 'user-1', availableCents: 5000, pendingCents: 0 }], // R$50,00
      });

      await assert.rejects(
        () =>
          processDebit(
            {
              userId: 'user-1',
              amount: 100, // R$100,00 > R$50,00
            },
            deps
          ),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.code, 'insufficient_funds');
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    it('handles exact balance edge case', async () => {
      const deps = makeDeps({
        $queryRaw: async () => [{ id: 'wallet-1', userId: 'user-1', availableCents: 10000, pendingCents: 0 }],
        wallet: {
          update: async () => ({ id: 'wallet-1', availableCents: 0 }),
        },
      });

      const result = await processDebit(
        {
          userId: 'user-1',
          amount: 100, // Exactly R$100,00
        },
        deps
      );

      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.balance, 0);
    });
  });

  describe('race condition handling (P2002)', () => {
    it('returns idempotent result on unique constraint violation', async () => {
      const mockPrisma = makeMockPrisma();

      // Override $transaction to throw P2002
      mockPrisma.$transaction = async () => {
        const error: any = new Error('Unique constraint violation');
        error.code = 'P2002';
        throw error;
      };

      // After P2002, query the transaction
      mockPrisma.walletTransaction.findUnique = async () => ({
        id: 'race-winner-tx',
        referenceId: 'shipment:ship-1',
      });

      mockPrisma.wallet.findUnique = async () => ({
        id: 'wallet-1',
        availableCents: 85000,
      });

      const deps = { prisma: mockPrisma, logger: undefined };

      const result = await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: 150,
        },
        deps
      );

      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.idempotent, true);
      assert.strictEqual(result.transactionId, 'race-winner-tx');
    });
  });

  describe('cart finalization', () => {
    it('finalizes cart when all shipments are paid', async () => {
      let cartUpdated = false;
      let cartItemsDeleted = false;

      const deps = makeDeps({
        cart: {
          findFirst: async () => ({
            id: 'cart-1',
            userId: 'user-1',
            status: 'LOCKED',
            meta: { shipmentIds: ['ship-1', 'ship-2'] },
          }),
          update: async (args: any) => {
            cartUpdated = true;
            assert.strictEqual(args.data.status, 'CHECKED_OUT');
            return {};
          },
        },
        cartItem: {
          deleteMany: async () => {
            cartItemsDeleted = true;
            return { count: 2 };
          },
        },
        shipment: {
          findUnique: async () => ({ id: 'ship-1', senderId: 'user-1' }),
          findMany: async (args: any) => {
            // Return all cart shipments as paid
            if (args.where.id?.in?.includes('ship-2')) {
              return [
                { id: 'ship-1', paymentMethod: 'WALLET' },
                { id: 'ship-2', paymentMethod: 'WALLET' },
              ];
            }
            return [{ id: 'ship-1', senderId: 'user-1', document: {} }];
          },
          update: async () => ({ id: 'ship-1' }),
        },
      });

      await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: 100,
        },
        deps
      );

      assert.ok(cartUpdated);
      assert.ok(cartItemsDeleted);
    });

    it('does not finalize cart when not all shipments paid', async () => {
      let cartUpdated = false;

      const deps = makeDeps({
        cart: {
          findFirst: async () => ({
            id: 'cart-1',
            userId: 'user-1',
            status: 'LOCKED',
            meta: { shipmentIds: ['ship-1', 'ship-2'] },
          }),
          update: async () => {
            cartUpdated = true;
            return {};
          },
        },
        shipment: {
          findUnique: async () => ({ id: 'ship-1', senderId: 'user-1' }),
          findMany: async (args: any) => {
            // Return cart shipments - one unpaid
            if (args.where.id?.in?.includes('ship-2')) {
              return [
                { id: 'ship-1', paymentMethod: 'WALLET' },
                { id: 'ship-2', paymentMethod: null }, // Not paid yet
              ];
            }
            return [{ id: 'ship-1', senderId: 'user-1', document: {} }];
          },
          update: async () => ({ id: 'ship-1' }),
        },
      });

      await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: 100,
        },
        deps
      );

      assert.strictEqual(cartUpdated, false);
    });
  });

  describe('multiple shipments via metadata', () => {
    it('processes multiple shipments from metadata.shipmentIds', async () => {
      const updatedShipmentIds: string[] = [];

      const deps = makeDeps({
        shipment: {
          findUnique: async () => null, // No single shipment ID
          findMany: async () => [
            { id: 'ship-1', senderId: 'user-1', document: {} },
            { id: 'ship-2', senderId: 'user-1', document: {} },
            { id: 'ship-3', senderId: 'user-1', document: {} },
          ],
          update: async (args: any) => {
            updatedShipmentIds.push(args.where.id);
            return { id: args.where.id };
          },
        },
      });

      const result = await processDebit(
        {
          userId: 'user-1',
          amount: 300,
          metadata: {
            shipmentIds: ['ship-1', 'ship-2', 'ship-3'],
          },
        },
        deps
      );

      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.shipmentIds, ['ship-1', 'ship-2', 'ship-3']);
      assert.strictEqual(updatedShipmentIds.length, 3);
    });
  });

  describe('transaction metadata', () => {
    it('includes trackingCode in transaction meta', async () => {
      let transactionMeta: any = null;

      const deps = makeDeps({
        walletTransaction: {
          create: async (args: any) => {
            transactionMeta = args.data.meta;
            return { id: 'tx-new' };
          },
        },
      });

      await processDebit(
        {
          userId: 'user-1',
          shipmentId: 'ship-1',
          amount: 100,
          trackingCode: 'AB123456789BR',
        },
        deps
      );

      assert.ok(transactionMeta);
      assert.strictEqual(transactionMeta.trackingCode, 'AB123456789BR');
      assert.strictEqual(transactionMeta.shipmentId, 'ship-1');
    });

    it('merges custom metadata', async () => {
      let transactionMeta: any = null;

      const deps = makeDeps({
        walletTransaction: {
          create: async (args: any) => {
            transactionMeta = args.data.meta;
            return { id: 'tx-new' };
          },
        },
      });

      await processDebit(
        {
          userId: 'user-1',
          amount: 100,
          metadata: {
            customField: 'customValue',
            orderId: 'order-123',
          },
        },
        deps
      );

      assert.ok(transactionMeta);
      assert.strictEqual(transactionMeta.customField, 'customValue');
      assert.strictEqual(transactionMeta.orderId, 'order-123');
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('debit.service - edge cases', () => {
  it('handles zero amount debit', async () => {
    const deps = makeDeps({
      wallet: {
        update: async () => ({ id: 'wallet-1', availableCents: 100000 }),
      },
    });

    const result = await processDebit(
      {
        userId: 'user-1',
        amount: 0,
      },
      deps
    );

    assert.strictEqual(result.ok, true);
  });

  it('handles very small amounts (1 centavo)', async () => {
    const deps = makeDeps({
      wallet: {
        update: async () => ({ id: 'wallet-1', availableCents: 99999 }),
      },
    });

    const result = await processDebit(
      {
        userId: 'user-1',
        amount: 0.01,
      },
      deps
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.balance, 999.99);
  });

  it('handles large amounts', async () => {
    const deps = makeDeps({
      $queryRaw: async () => [{ id: 'wallet-1', userId: 'user-1', availableCents: 100000000, pendingCents: 0 }], // R$1M
      wallet: {
        update: async () => ({ id: 'wallet-1', availableCents: 50000000 }),
      },
    });

    const result = await processDebit(
      {
        userId: 'user-1',
        amount: 500000, // R$500k
      },
      deps
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.balance, 500000);
  });

  it('skips shipment update when no shipment provided', async () => {
    let shipmentUpdateCalled = false;

    const deps = makeDeps({
      shipment: {
        findUnique: async () => null,
        findMany: async () => [],
        update: async () => {
          shipmentUpdateCalled = true;
          return {};
        },
      },
    });

    await processDebit(
      {
        userId: 'user-1',
        amount: 100,
        reason: 'manual_adjustment',
      },
      deps
    );

    assert.strictEqual(shipmentUpdateCalled, false);
  });
});
