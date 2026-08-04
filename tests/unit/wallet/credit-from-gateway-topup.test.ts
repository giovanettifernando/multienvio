import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// wallet.service.ts -> '@/platform/db/db' importa 'server-only' (conexão real
// com o banco no escopo do módulo). Sob node --test (fora do bundler do
// Next.js) isso lança/quebra no import estático. Mesmo padrão de stub já
// usado em tests/unit/asaas/tracking.test.ts (Task 7). wallet.service.ts
// também importa ./ledger-balance.service, que por sua vez importa
// platform/cache/cache -> platform/cache/redis (também 'server-only' +
// conexão real com Redis) — stubamos o módulo inteiro para não precisar de
// Redis disponível para rodar este teste.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const LEDGER_BALANCE_PATH = path.resolve(ROOT, 'modules/wallet/application/ledger-balance.service.ts');
const WALLET_SERVICE_PATH = path.resolve(ROOT, 'modules/wallet/application/wallet.service.ts');

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: {} } } as any;
  require.cache[LEDGER_BALANCE_PATH] = {
    id: LEDGER_BALANCE_PATH,
    filename: LEDGER_BALANCE_PATH,
    loaded: true,
    exports: {
      getWalletBalanceByUserId: async () => ({ availableCents: 0, pendingCents: 0 }),
      invalidateWalletBalanceCache: async () => {},
    },
  } as any;
}

before(() => {
  stubModules();
  delete require.cache[WALLET_SERVICE_PATH];
});

function loadWalletService() {
  return req(WALLET_SERVICE_PATH) as typeof import('../../../modules/wallet/application/wallet.service');
}

function fakePrisma(overrides: Record<string, unknown> = {}) {
  return {
    paymentTransaction: {
      findUnique: async () => null,
    },
    walletTransaction: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({
        id: 'wtx_1',
        ...data,
        createdAt: new Date(),
        confirmedAt: new Date(),
      }),
    },
    wallet: {
      findUnique: async () => ({ id: 'w_1', userId: 'user-1', availableCents: 0, pendingCents: 0 }),
      create: async ({ data }: any) => ({ id: 'w_1', ...data }),
      update: async ({ data }: any) => ({ id: 'w_1', userId: 'user-1', availableCents: 5000, pendingCents: 0, ...data }),
    },
    ledgerEntry: {
      create: async ({ data }: any) => ({ id: 'le_1', ...data }),
    },
    // creditFromGatewayTopup usa a forma "array" de $transaction: os
    // elementos já são promises resolvendo contra os stubs acima.
    $transaction: async (arr: unknown[]) => Promise.all(arr),
    ...overrides,
  };
}

describe('creditFromGatewayTopup — gate de liberação (canReleaseService)', () => {
  it('credita a carteira quando o cartão foi CAPTURED (antes só PAID liberava)', async () => {
    const { creditFromGatewayTopup } = loadWalletService();
    const dbModule = require.cache[DB_PATH]!;
    dbModule.exports.prisma = fakePrisma({
      paymentTransaction: {
        findUnique: async () => ({ id: 'ptx_1', status: 'CAPTURED', amountCents: 5000 }),
      },
    });

    const result = await creditFromGatewayTopup({
      userId: 'user-1',
      amountCents: 5000,
      paymentTransactionId: 'ptx_1',
    });

    assert.equal(result.amountCents, 5000);
  });

  it('credita a carteira quando o pagamento está PAID', async () => {
    const { creditFromGatewayTopup } = loadWalletService();
    const dbModule = require.cache[DB_PATH]!;
    dbModule.exports.prisma = fakePrisma({
      paymentTransaction: {
        findUnique: async () => ({ id: 'ptx_2', status: 'PAID', amountCents: 5000 }),
      },
    });

    const result = await creditFromGatewayTopup({
      userId: 'user-1',
      amountCents: 5000,
      paymentTransactionId: 'ptx_2',
    });

    assert.equal(result.amountCents, 5000);
  });

  it('NÃO credita enquanto o pagamento está PENDING (boleto/PIX ainda não confirmado)', async () => {
    const { creditFromGatewayTopup } = loadWalletService();
    const dbModule = require.cache[DB_PATH]!;
    dbModule.exports.prisma = fakePrisma({
      paymentTransaction: {
        findUnique: async () => ({ id: 'ptx_3', status: 'PENDING', amountCents: 5000 }),
      },
    });

    await assert.rejects(
      creditFromGatewayTopup({ userId: 'user-1', amountCents: 5000, paymentTransactionId: 'ptx_3' }),
    );
  });

  it('NÃO credita em FAILED/CANCELED/REFUNDED/CHARGEBACK', async () => {
    const { creditFromGatewayTopup } = loadWalletService();
    const dbModule = require.cache[DB_PATH]!;

    for (const status of ['FAILED', 'CANCELED', 'REFUNDED', 'CHARGEBACK']) {
      dbModule.exports.prisma = fakePrisma({
        paymentTransaction: {
          findUnique: async () => ({ id: `ptx_${status}`, status, amountCents: 5000 }),
        },
      });

      await assert.rejects(
        creditFromGatewayTopup({ userId: 'user-1', amountCents: 5000, paymentTransactionId: `ptx_${status}` }),
        undefined,
        `status ${status} não deveria liberar crédito`,
      );
    }
  });
});
