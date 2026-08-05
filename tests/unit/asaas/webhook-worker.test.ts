import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// workers/webhook/asaas.worker.ts importa 'bullmq' (Worker), a fila
// (platform/queue, que por sua vez usa bullmq/ioredis só como definição de
// classe — nada conecta na importação) e @/platform/integrations/asaas, cuja
// árvore de submódulos (config.ts, client.ts, cards.ts, charges.ts,
// customers.ts, tracking.ts, webhooks.ts) tem vários `import 'server-only'` e
// um `import '@/platform/db/db'` (que também tem `import 'server-only'`).
// Sob node --test (CommonJS puro) isso lança no require estático. Mesmo
// padrão de stub via require.cache já usado em
// tests/integration/webhooks/asaas-webhook.test.ts (Task 10) e
// tests/unit/asaas/tracking.test.ts (Task 7).
//
// NUNCA chamamos createAsaasWebhookWorker() aqui — isso instanciaria um
// Worker BullMQ de verdade, exigindo Redis vivo. Testamos só as funções puras
// processAsaasWebhookJob/runAsaasWebhookJob, com deps injetadas.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const WORKER_PATH = path.resolve(ROOT, 'workers/webhook/asaas.worker.ts');

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = {
    id: DB_PATH,
    filename: DB_PATH,
    loaded: true,
    exports: {
      prisma: {},
      isDatabaseUnavailableError: () => false,
      schedulePrismaReconnect: async () => {},
    },
  } as any;
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
}

stubModules();
delete require.cache[WORKER_PATH];

function loadWorker() {
  return req(WORKER_PATH) as typeof import('../../../workers/webhook/asaas.worker');
}

/** Prisma fake com um único registro paymentWebhook, para simular updateMany com filtro por status. */
function makeFakePaymentWebhook(initialStatus: string) {
  const record: { status: string; errorMessage: string | null; processedAt: Date | null } = {
    status: initialStatus,
    errorMessage: null,
    processedAt: null,
  };

  const calls: Array<{ where: any; data: any }> = [];

  const prisma = {
    paymentWebhook: {
      updateMany: async ({ where, data }: any) => {
        calls.push({ where, data });

        const statusFilter = where.status;
        const matches =
          statusFilter && typeof statusFilter === 'object' && 'in' in statusFilter
            ? statusFilter.in.includes(record.status)
            : statusFilter === record.status;

        if (!matches) return { count: 0 };

        Object.assign(record, data);
        return { count: 1 };
      },
    },
    // O worker localiza a PaymentTransaction da cobrança para disparar o
    // crédito da recarga. Sem isto o mock quebra antes de chegar no updateMany.
    paymentTransaction: {
      findFirst: async () => ({ id: 'tx_1' }),
    },
  };

  return { record, calls, prisma };
}

describe('processAsaasWebhookJob', () => {
  it('marca PROCESSED mesmo quando o registro está FAILED (retry bem-sucedido após falha)', async () => {
    const { processAsaasWebhookJob } = loadWorker();
    const { record, prisma } = makeFakePaymentWebhook('FAILED');

    await processAsaasWebhookJob(
      { chargeId: 'pay_1', event: 'PAYMENT_CONFIRMED' },
      { prisma: prisma as never, updatePaymentFromAsaas: async () => {}, creditTopupIfReleased: async () => false },
    );

    assert.equal(record.status, 'PROCESSED');
    assert.ok(record.processedAt instanceof Date);
  });

  it('marca PROCESSED quando o registro está PENDING (caminho feliz, sem retry)', async () => {
    const { processAsaasWebhookJob } = loadWorker();
    const { record, prisma } = makeFakePaymentWebhook('PENDING');

    await processAsaasWebhookJob(
      { chargeId: 'pay_2', event: 'PAYMENT_CONFIRMED' },
      { prisma: prisma as never, updatePaymentFromAsaas: async () => {}, creditTopupIfReleased: async () => false },
    );

    assert.equal(record.status, 'PROCESSED');
  });
});

describe('runAsaasWebhookJob', () => {
  it('1ª tentativa falha marca FAILED e relança; retry bem-sucedido corrige para PROCESSED', async () => {
    const { runAsaasWebhookJob } = loadWorker();
    const { record, prisma } = makeFakePaymentWebhook('PENDING');

    let attempt = 0;
    const updatePaymentFromAsaas = async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('Falha simulada na API do Asaas');
    };

    // 1ª tentativa: updatePaymentFromAsaas falha -> catch marca FAILED e relança.
    await assert.rejects(
      () =>
        runAsaasWebhookJob(
          { chargeId: 'pay_3', event: 'PAYMENT_CONFIRMED' },
          { prisma: prisma as never, updatePaymentFromAsaas, creditTopupIfReleased: async () => false },
        ),
      /Falha simulada na API do Asaas/,
    );
    assert.equal(record.status, 'FAILED');
    assert.equal(record.errorMessage, 'Falha simulada na API do Asaas');

    // Retry (o BullMQ chamaria de novo com os mesmos dados): dessa vez a API responde.
    // Se a marcação de sucesso ainda filtrasse por status: 'PENDING', este updateMany
    // não casaria nada (o registro está FAILED) e o registro ficaria FAILED para sempre
    // mesmo com o pagamento já reconhecido — exatamente o bug que este teste sabota.
    await runAsaasWebhookJob(
      { chargeId: 'pay_3', event: 'PAYMENT_CONFIRMED' },
      { prisma: prisma as never, updatePaymentFromAsaas, creditTopupIfReleased: async () => false },
    );

    assert.equal(record.status, 'PROCESSED');
    assert.equal(attempt, 2);
  });

  it('sucesso de primeira (sem falha anterior) marca PROCESSED direto', async () => {
    const { runAsaasWebhookJob } = loadWorker();
    const { record, prisma } = makeFakePaymentWebhook('PENDING');

    await runAsaasWebhookJob(
      { chargeId: 'pay_4', event: 'PAYMENT_CONFIRMED' },
      { prisma: prisma as never, updatePaymentFromAsaas: async () => {}, creditTopupIfReleased: async () => false },
    );

    assert.equal(record.status, 'PROCESSED');
  });
});

describe('processAsaasWebhookJob — crédito da recarga', () => {
  // Antes desta cobertura o worker só sincronizava o status: uma recarga
  // confirmada por PIX/boleto virava CAPTURED/PAID e o saldo do cliente
  // NUNCA era creditado (o crédito só existia na rota administrativa de
  // aprovação manual). Dinheiro cobrado, nada entregue.
  it('dispara o crédito da transação correspondente à cobrança', async () => {
    const { processAsaasWebhookJob } = loadWorker();
    const { prisma } = makeFakePaymentWebhook('PENDING');

    const creditados: string[] = [];

    await processAsaasWebhookJob(
      { chargeId: 'pay_credito', event: 'PAYMENT_RECEIVED' },
      {
        prisma: prisma as never,
        updatePaymentFromAsaas: async () => {},
        creditTopupIfReleased: async (id: string) => {
          creditados.push(id);
          return true;
        },
      },
    );

    assert.deepEqual(creditados, ['tx_1'], 'o crédito precisa ser chamado com o id da transação');
  });

  it('não quebra quando a cobrança não tem transação local', async () => {
    const { processAsaasWebhookJob } = loadWorker();
    const { record, prisma } = makeFakePaymentWebhook('PENDING');
    prisma.paymentTransaction.findFirst = async () => null as never;

    let chamou = false;

    await processAsaasWebhookJob(
      { chargeId: 'pay_orfao', event: 'PAYMENT_RECEIVED' },
      {
        prisma: prisma as never,
        updatePaymentFromAsaas: async () => {},
        creditTopupIfReleased: async () => {
          chamou = true;
          return true;
        },
      },
    );

    assert.equal(chamou, false, 'sem transação local não há o que creditar');
    assert.equal(record.status, 'PROCESSED', 'o webhook ainda deve ser marcado como processado');
  });
});
