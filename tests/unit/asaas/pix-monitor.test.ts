import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// pix-monitor.ts -> 'server-only' e @/platform/db/db (conexão real com o banco no
// escopo do módulo). Sob node --test (CommonJS puro, fora do bundler do Next.js)
// isso lança/quebra no import estático. Mesmo padrão de stub já usado em
// tests/unit/asaas/charges.test.ts (Task 4) e tracking.test.ts (Task 9).
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const PIX_MONITOR_PATH = path.resolve(ROOT, 'platform/integrations/asaas/pix-monitor.ts');

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: {} } } as any;
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
}

before(() => {
  stubModules();
  delete require.cache[PIX_MONITOR_PATH];
});

function loadPixMonitor() {
  return req(PIX_MONITOR_PATH) as typeof import('../../../platform/integrations/asaas/pix-monitor');
}

function makeDeps(charges: Record<string, { status: string }>) {
  const updates: any[] = [];
  return {
    updates,
    deps: {
      prisma: {
        paymentTransaction: {
          findMany: async () => [
            { id: 'tx_1', externalId: 'pay_1', amountCents: 4990, method: 'PIX' },
            { id: 'tx_2', externalId: 'pay_2', amountCents: 8990, method: 'BOLETO' },
          ],
          update: async ({ where, data }: any) => {
            updates.push({ id: where.id, ...data });
            return {};
          },
        },
      },
      getCharge: async (id: string) => ({ id, ...charges[id], value: 49.9 }),
    } as never,
  };
}

describe('syncPendingCharges', () => {
  it('atualiza a transação quando o pagamento foi confirmado', async () => {
    const { syncPendingCharges } = loadPixMonitor();
    const { deps, updates } = makeDeps({
      pay_1: { status: 'RECEIVED' },
      pay_2: { status: 'PENDING' },
    });

    const result = await syncPendingCharges(deps);

    assert.equal(result.checked, 2);
    assert.equal(result.updated, 1);
    assert.equal(updates[0].id, 'tx_1');
    assert.equal(updates[0].status, 'PAID');
  });

  it('marca boleto vencido como cancelado', async () => {
    const { syncPendingCharges } = loadPixMonitor();
    const { deps, updates } = makeDeps({
      pay_1: { status: 'PENDING' },
      pay_2: { status: 'OVERDUE' },
    });

    const result = await syncPendingCharges(deps);

    assert.equal(result.expired, 1);
    assert.equal(updates[0].id, 'tx_2');
    assert.equal(updates[0].status, 'CANCELED');
  });

  it('não atualiza nada quando tudo segue pendente', async () => {
    const { syncPendingCharges } = loadPixMonitor();
    const { deps, updates } = makeDeps({
      pay_1: { status: 'PENDING' },
      pay_2: { status: 'PENDING' },
    });

    const result = await syncPendingCharges(deps);

    assert.equal(result.updated, 0);
    assert.equal(updates.length, 0);
  });

  it('falha ao consultar uma cobrança não aborta a varredura das demais', async () => {
    const { syncPendingCharges } = loadPixMonitor();
    const updates: any[] = [];
    const deps = {
      prisma: {
        paymentTransaction: {
          findMany: async () => [
            { id: 'tx_1', externalId: 'pay_1', amountCents: 4990, method: 'PIX' },
            { id: 'tx_2', externalId: 'pay_2', amountCents: 8990, method: 'BOLETO' },
          ],
          update: async ({ where, data }: any) => {
            updates.push({ id: where.id, ...data });
            return {};
          },
        },
      },
      // pay_1 (a primeira da varredura) explode com erro de rede; pay_2 tem que
      // continuar sendo verificada mesmo assim.
      getCharge: async (id: string) => {
        if (id === 'pay_1') throw new Error('timeout de rede');
        return { id, status: 'RECEIVED', value: 89.9 };
      },
    } as never;

    const result = await syncPendingCharges(deps);

    assert.equal(result.checked, 2);
    assert.equal(result.updated, 1);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].id, 'tx_2');
    assert.equal(updates[0].status, 'PAID');
  });

  it('nunca grava taxa negativa quando o valor líquido do Asaas excede o bruto', async () => {
    const { syncPendingCharges } = loadPixMonitor();
    const updates: any[] = [];
    const deps = {
      prisma: {
        paymentTransaction: {
          findMany: async () => [
            { id: 'tx_1', externalId: 'pay_1', amountCents: 4990, method: 'PIX' },
          ],
          update: async ({ where, data }: any) => {
            updates.push({ id: where.id, ...data });
            return {};
          },
        },
      },
      // netValue reportado maior que o bruto: resposta inesperada da API que não
      // pode virar feeCents negativo no nosso banco.
      getCharge: async (id: string) => ({ id, status: 'RECEIVED', value: 49.9, netValue: 60 }),
    } as never;

    const result = await syncPendingCharges(deps);

    assert.equal(result.updated, 1);
    assert.equal(updates[0].feeCents, 0);
  });
});
