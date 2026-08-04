import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// create-cart-shipments-with-payment.service.ts tem uma árvore de imports
// pesada: '@/platform/db/db' ('server-only'), create-with-volumes.ts, comissões
// (modules/quotes), integração com transportadora, envio de e-mail e
// '@/platform/queue' (BullMQ + Redis). Sob node --test isso lança/quebra ou
// tenta abrir conexões reais no import estático. Mesmo padrão de stub de
// tests/unit/asaas/tracking.test.ts (Task 7): substituímos os módulos pesados
// por dublês mínimos antes de carregar o service, para testar só o gate de
// liberação do pagamento do gateway (dono / valor / status / reuso) sem
// depender de banco, fila, comissão ou transportadora reais.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const CREATE_WITH_VOLUMES_PATH = path.resolve(ROOT, 'modules/shipments/application/create-with-volumes.ts');
const COMMISSION_PATH = path.resolve(ROOT, 'modules/quotes/application/commission.ts');
const CARRIER_INTEGRATION_PATH = path.resolve(ROOT, 'modules/shipments/application/carrier-integration.ts');
const MAILER_PATH = path.resolve(ROOT, 'platform/email/mailer.ts');
const QUEUE_INDEX_PATH = path.resolve(ROOT, 'platform/queue/index.ts');
const SERVICE_PATH = path.resolve(ROOT, 'modules/cart/application/create-cart-shipments-with-payment.service.ts');

function stubModule(absPath: string, exports: Record<string, unknown>) {
  require.cache[absPath] = { id: absPath, filename: absPath, loaded: true, exports } as any;
}

before(() => {
  stubModule(SERVER_ONLY_PATH, {});
  stubModule(DB_PATH, { prisma: {} });
  stubModule(CREATE_WITH_VOLUMES_PATH, {
    createShipmentWithVolumes: async (_tx: unknown, input: any) => ({
      shipment: {
        id: `shp_${input.shipment.platformTrackingCode}`,
        platformTrackingCode: input.shipment.platformTrackingCode,
        publicTrackingId: `pub_${input.shipment.platformTrackingCode}`,
      },
      packages: [],
    }),
  });
  stubModule(COMMISSION_PATH, {
    calculateCommissionsInCents: async () => ({ shippingCommissionCents: 0, pickupCommissionCents: 0 }),
  });
  stubModule(CARRIER_INTEGRATION_PATH, {
    integrateWithCarrier: async () => ({ success: true }),
  });
  stubModule(MAILER_PATH, {
    sendShipmentTrackingEmail: async () => true,
  });
  stubModule(QUEUE_INDEX_PATH, {
    getQueue: () => ({ add: async () => {} }),
    QUEUE_NAMES: { LABEL_GENERATE: 'label.generate' },
    JOB_PRIORITY: { HIGH: 1 },
  });
  delete require.cache[SERVICE_PATH];
});

function loadService() {
  return req(SERVICE_PATH) as typeof import('../../../modules/cart/application/create-cart-shipments-with-payment.service');
}

const cartItemFixture = {
  id: 'item_1',
  originAddress: { cep: '01001000' },
  destination: {
    nome: 'Maria',
    cep: '01001000',
    logradouro: 'Rua A',
    numero: '10',
    bairro: 'Centro',
    cidade: 'São Paulo',
    uf: 'SP',
  },
  volumes: [{ pesoKg: 1, alturaCm: 10, larguraCm: 10, comprimentoCm: 10 }],
  preferences: null,
  selectedQuote: { carrier: 'Correios', serviceName: 'PAC', deadlineDays: 5, price: 20 },
  pickupFee: null,
  document: null,
  insuranceValue: null,
  pickupPoint: null,
  totals: { total: 20 },
};

function fakeTx(overrides: Record<string, unknown> = {}) {
  return {
    walletTransaction: {
      findUnique: async () => null, // não idempotente
    },
    trackingCodeReservation: {
      findMany: async () => [{ code: 'EL1' }],
      updateMany: async () => ({ count: 1 }),
    },
    cart: {
      findFirst: async () => ({ id: 'cart_1', items: [cartItemFixture] }),
      update: async () => ({}),
    },
    cartItem: {
      deleteMany: async () => ({}),
      count: async () => 0,
    },
    label: {
      create: async ({ data }: any) => ({ id: `lbl_${data.trackingCode}`, ...data }),
    },
    pickupRequest: {
      findUnique: async () => null,
      create: async ({ data }: any) => ({ id: 'pr_1', ...data }),
    },
    user: {
      findUnique: async () => ({
        name: 'Remetente Teste',
        razaoSocial: null,
        email: 'remetente@teste.com',
        phone: null,
        cpf: '12345678900',
        cnpj: null,
      }),
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
    reservedTrackingCodes: ['EL1'],
    itemIds: ['item_1'],
    paymentMethod: 'PAGARME' as const,
    ...overrides,
  };
}

describe('createCartShipmentsWithPayment — gate de liberação do pagamento do gateway', () => {
  it('rejeita quando a transação pertence a outro usuário (dono)', async () => {
    const { createCartShipmentsWithPayment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_1',
                userId: 'outro-usuario',
                status: 'CAPTURED',
                amountCents: 2000,
                metadata: null,
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createCartShipmentsWithPayment(baseInput({ pagarmePaymentId: 'ptx_1' })),
    );
  });

  it('rejeita quando o valor da transação é insuficiente', async () => {
    const { createCartShipmentsWithPayment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_2',
                userId: 'user-1',
                status: 'CAPTURED',
                amountCents: 500, // menor que os 2000 (20 * 100) do carrinho
                metadata: null,
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createCartShipmentsWithPayment(baseInput({ pagarmePaymentId: 'ptx_2' })),
    );
  });

  it('rejeita enquanto o pagamento está PENDING', async () => {
    const { createCartShipmentsWithPayment } = loadService();
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
      createCartShipmentsWithPayment(baseInput({ pagarmePaymentId: 'ptx_3' })),
    );
  });

  it('rejeita quando a transação já foi usada para liberar outro checkout (reuso)', async () => {
    const { createCartShipmentsWithPayment } = loadService();
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
                metadata: { shipmentIds: ['shp_outro'] }, // já consumida
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createCartShipmentsWithPayment(baseInput({ pagarmePaymentId: 'ptx_4' })),
    );
  });

  it('libera e cria os envios quando CAPTURED, do próprio usuário e com valor correto', async () => {
    const { createCartShipmentsWithPayment } = loadService();
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

    const result = await createCartShipmentsWithPayment(baseInput({ pagarmePaymentId: 'ptx_5' }));

    assert.deepEqual(result.shipmentIds, ['shp_EL1']);
    assert.equal(result.isIdempotent, false);
    assert.deepEqual(updatedMetadata, { shipmentIds: ['shp_EL1'] }, 'marca a transação como consumida');
  });
});
