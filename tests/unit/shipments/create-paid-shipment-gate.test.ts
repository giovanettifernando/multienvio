import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// create-paid-shipment.service.ts -> '@/platform/db/db' ('server-only'),
// checkout.service.ts ('server-only' + integração com transportadora),
// create-with-volumes.ts (grava shipment/packages reais) e '@/platform/queue'
// (BullMQ + Redis reais). Sob node --test (fora do bundler do Next.js) tudo
// isso lança/quebra ou tenta abrir conexões reais no import estático. Mesmo
// padrão de stub de tests/unit/asaas/tracking.test.ts (Task 7), estendido para
// a árvore de imports deste service: substituímos cada módulo pesado por um
// dublê mínimo ANTES de carregar create-paid-shipment.service.ts, para poder
// testar só a regra que nos interessa aqui — o gate de liberação do pagamento
// do gateway (dono / valor / status / reuso) — sem depender de banco, fila ou
// integração de transportadora reais.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const CREATE_WITH_VOLUMES_PATH = path.resolve(ROOT, 'modules/shipments/application/create-with-volumes.ts');
const CHECKOUT_SERVICE_PATH = path.resolve(ROOT, 'modules/cart/application/checkout.service.ts');
const QUEUE_INDEX_PATH = path.resolve(ROOT, 'platform/queue/index.ts');
const SERVICE_PATH = path.resolve(ROOT, 'modules/shipments/application/create-paid-shipment.service.ts');

function stubModule(absPath: string, exports: Record<string, unknown>) {
  require.cache[absPath] = { id: absPath, filename: absPath, loaded: true, exports } as any;
}

before(() => {
  stubModule(SERVER_ONLY_PATH, {});
  stubModule(DB_PATH, { prisma: {} });
  stubModule(CREATE_WITH_VOLUMES_PATH, {
    createShipmentWithVolumes: async (_tx: unknown, input: any) => ({
      shipment: {
        id: 'shp_new',
        platformTrackingCode: input.shipment.platformTrackingCode,
        publicTrackingId: 'pub_new',
      },
      packages: [],
    }),
  });
  stubModule(CHECKOUT_SERVICE_PATH, {
    calculateDeclaredValue: () => 0,
    prepareDocumentData: () => ({}),
    determineInitialStatus: () => 'AWAITING_DROP_OFF_AT_POINT',
    saveRecipientIfRequested: async () => {},
  });
  stubModule(QUEUE_INDEX_PATH, {
    getQueue: () => ({ add: async () => {} }),
    QUEUE_NAMES: { SHIPMENT_CREATE: 'shipment.create' },
    JOB_PRIORITY: { HIGH: 1 },
  });
  delete require.cache[SERVICE_PATH];
});

function loadService() {
  return req(SERVICE_PATH) as typeof import('../../../modules/shipments/application/create-paid-shipment.service');
}

const baseRecipient = {
  nome: 'Maria',
  cep: '01001000',
  cidade: 'São Paulo',
  uf: 'SP',
};

const baseDocument = { type: 'DECLARACAO' as const };

const baseVolumes = [{ peso: 1, altura: 10, largura: 10, comprimento: 10 }];

function fakeTx(overrides: Record<string, unknown> = {}) {
  return {
    shipment: {
      findFirst: async () => null, // não idempotente
    },
    trackingCodeReservation: {
      findFirst: async () => ({ code: 'EL123', userId: 'user-1' }), // reserva válida
      updateMany: async () => ({ count: 1 }),
    },
    label: {
      create: async ({ data }: any) => ({ id: 'lbl_1', ...data }),
    },
    paymentTransaction: {
      findUnique: async () => null,
      update: async ({ data }: any) => ({ id: 'ptx_1', ...data }),
    },
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    trackingCode: 'EL123',
    recipient: baseRecipient,
    document: baseDocument,
    volumes: baseVolumes,
    carrier: 'Correios',
    service: 'PAC',
    originCep: '01001000',
    destinationCep: '01001000',
    estimatedDays: 5,
    freightCost: 20,
    totalCost: 20,
    paymentMethod: 'PAGARME' as const,
    ...overrides,
  };
}

describe('createPaidShipment — gate de liberação do pagamento do gateway', () => {
  it('rejeita quando a transação pertence a outro usuário (dono)', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_1',
                userId: 'outro-usuario', // não é 'user-1'
                status: 'CAPTURED',
                amountCents: 2000,
                metadata: null,
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_1', totalCost: 20 })),
    );
  });

  it('rejeita quando o valor da transação é insuficiente', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_2',
                userId: 'user-1',
                status: 'CAPTURED',
                amountCents: 500, // menor que os 2000 do totalCost
                metadata: null,
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_2', totalCost: 20 })),
    );
  });

  it('rejeita enquanto o pagamento está PENDING', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_3',
                userId: 'user-1',
                status: 'PENDING',
                amountCents: 2000,
                metadata: null,
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_3', totalCost: 20 })),
    );
  });

  it('rejeita quando a transação já foi usada para liberar outro envio (reuso)', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_4',
                userId: 'user-1',
                status: 'CAPTURED',
                amountCents: 2000,
                metadata: { shipmentId: 'shp_outro' }, // já consumida
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_4', totalCost: 20 })),
    );
  });

  it('libera e cria o envio quando CAPTURED, do próprio usuário e com valor correto', async () => {
    const { createPaidShipment } = loadService();
    let updatedMetadata: unknown;
    require.cache[DB_PATH]!.exports.prisma = {
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_5',
                userId: 'user-1',
                status: 'CAPTURED',
                amountCents: 2000,
                metadata: null,
              }),
              update: async ({ data }: any) => {
                updatedMetadata = data.metadata;
                return { id: 'ptx_5', ...data };
              },
            },
          }),
        ),
    };

    const result = await createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_5', totalCost: 20 }));

    assert.equal(result.shipmentId, 'shp_new');
    assert.equal(result.isIdempotent, false);
    assert.deepEqual(updatedMetadata, { shipmentId: 'shp_new' }, 'marca a transação como consumida');
  });
});
