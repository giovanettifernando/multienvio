import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// service.ts (recipients) -> '@/platform/db/db' ('server-only', conexão real de
// banco no escopo do módulo), checkout.service.ts ('server-only' + BullMQ/Redis
// via '@/platform/queue'), create-with-volumes.ts (grava shipment/packages
// reais) e carrier-integration.ts (chama APIs reais de transportadora). Sob
// node --test (fora do bundler do Next.js) tudo isso lança/quebra ou tenta
// abrir conexões reais no import estático. Mesmo padrão de stub via
// require.cache usado em tests/unit/asaas/tracking.test.ts (Task 7) e
// tests/unit/shipments/create-paid-shipment-gate.test.ts (Task 12):
// substituímos cada módulo pesado por um dublê mínimo ANTES de carregar
// service.ts, para testar só o gate de liberação do pagamento pelo
// destinatário (Task 12b) — sem depender de banco, fila ou integração de
// transportadora reais.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const CREATE_WITH_VOLUMES_PATH = path.resolve(ROOT, 'modules/shipments/application/create-with-volumes.ts');
const CARRIER_INTEGRATION_PATH = path.resolve(ROOT, 'modules/shipments/application/carrier-integration.ts');
const CHECKOUT_SERVICE_PATH = path.resolve(ROOT, 'modules/cart/application/checkout.service.ts');
const SERVICE_PATH = path.resolve(ROOT, 'modules/recipients/application/service.ts');

function stubModule(absPath: string, exports: Record<string, unknown>) {
  require.cache[absPath] = { id: absPath, filename: absPath, loaded: true, exports } as any;
}

// Contador de chamadas a createShipmentWithVolumes: usado pelos testes de
// rejeição para provar que NENHUM shipment foi criado quando o gate barra.
let createShipmentCalls = 0;
let lastCreatedTrackingCode: string | undefined;

before(() => {
  stubModule(SERVER_ONLY_PATH, {});
  stubModule(DB_PATH, { prisma: {} });
  stubModule(CREATE_WITH_VOLUMES_PATH, {
    createShipmentWithVolumes: async (_tx: unknown, input: any) => {
      createShipmentCalls += 1;
      lastCreatedTrackingCode = input.shipment.platformTrackingCode;
      return {
        shipment: {
          id: 'shp_new',
          platformTrackingCode: input.shipment.platformTrackingCode,
          publicTrackingId: 'pub_new',
        },
        packages: [],
      };
    },
  });
  stubModule(CARRIER_INTEGRATION_PATH, {
    integrateWithCarrier: async () => ({ success: true }),
  });
  stubModule(CHECKOUT_SERVICE_PATH, {
    generatePlatformTrackingCode: () => 'EL_TEST_1',
  });
  delete require.cache[SERVICE_PATH];
});

function loadService() {
  return req(SERVICE_PATH) as typeof import('../../../modules/recipients/application/service');
}

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

function baseRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req_1',
    status: 'PENDING',
    expiresAt: FUTURE,
    paymentToken: 'tok_1',
    pickupAtOrigin: false,
    senderId: 'sender_1',
    recipientName: 'Maria',
    recipientPhone: '11999999999',
    recipientEmail: 'maria@teste.com',
    recipientDocument: '12345678900',
    originCep: '01001000',
    originAddress: 'Rua A',
    originNumber: '10',
    originComplement: null,
    originNeighborhood: 'Centro',
    originCity: 'São Paulo',
    originState: 'SP',
    destinationCep: '20010000',
    destinationAddress: 'Rua B',
    destinationNumber: '20',
    destinationComplement: null,
    destinationNeighborhood: 'Centro',
    destinationCity: 'Rio de Janeiro',
    destinationState: 'RJ',
    declaredValue: 100,
    carrier: 'Correios',
    service: 'PAC',
    serviceCode: '03298',
    estimatedDays: 5,
    freightCostCents: 2000,
    pickupFeeCents: null,
    totalCents: 2000, // valor esperado do request — usado no teste de valor insuficiente
    shippingCommissionCents: 100,
    pickupCommissionCents: null,
    document: {},
    shipmentId: null,
    packages: [{ weight: 1, height: 10, width: 10, length: 10 }],
    sender: {
      id: 'sender_1',
      name: 'Remetente',
      razaoSocial: null,
      email: 'remetente@teste.com',
      phone: null,
      cpf: '12345678900',
      cnpj: null,
    },
    ...overrides,
  };
}

function fakeTx(overrides: Record<string, unknown> = {}) {
  return {
    recipientPaymentRequest: {
      findUnique: async () => baseRequestRow(),
      update: async () => ({}),
      updateMany: async () => ({ count: 1 }),
    },
    paymentTransaction: {
      findUnique: async () => null,
      update: async ({ data }: any) => ({ id: 'ptx_1', ...data }),
    },
    trackingCodeReservation: {
      updateMany: async () => ({ count: 1 }),
    },
    label: {
      create: async ({ data }: any) => ({ id: 'lbl_1', ...data }),
    },
    pickupRequest: {
      create: async ({ data }: any) => ({ id: 'pr_1', ...data }),
    },
    ...overrides,
  };
}

function setPrisma(fn: (cb: any) => Promise<any>) {
  require.cache[DB_PATH]!.exports.prisma = { $transaction: fn };
}

describe('processRecipientPayment — gate de liberação do pagamento (Task 12b)', () => {
  it('rejeita quando a transação está PENDING (boleto/PIX ainda não pago) e não cria shipment', async () => {
    const { processRecipientPayment } = loadService();
    createShipmentCalls = 0;

    setPrisma((cb) =>
      cb(
        fakeTx({
          paymentTransaction: {
            findUnique: async () => ({
              id: 'ptx_pending',
              status: 'PENDING',
              amountCents: 2000,
              metadata: { recipientPaymentRequestId: 'req_1' },
            }),
          },
        }),
      ),
    );

    const result = await processRecipientPayment('tok_1', 'PIX', 'ptx_pending');

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /aguardando confirmação/i);
    assert.equal(createShipmentCalls, 0, 'pagamento PENDING não pode criar shipment');
  });

  it('rejeita quando a transação pertence a OUTRO request (vínculo)', async () => {
    const { processRecipientPayment } = loadService();
    createShipmentCalls = 0;

    setPrisma((cb) =>
      cb(
        fakeTx({
          paymentTransaction: {
            findUnique: async () => ({
              id: 'ptx_outro',
              status: 'CAPTURED',
              amountCents: 2000,
              metadata: { recipientPaymentRequestId: 'req_OUTRO' }, // não é 'req_1'
            }),
          },
        }),
      ),
    );

    const result = await processRecipientPayment('tok_1', 'PIX', 'ptx_outro');

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /não corresponde/i);
    assert.equal(createShipmentCalls, 0, 'transação de outro request não pode liberar este shipment');
  });

  it('rejeita quando o valor da transação é insuficiente', async () => {
    const { processRecipientPayment } = loadService();
    createShipmentCalls = 0;

    setPrisma((cb) =>
      cb(
        fakeTx({
          paymentTransaction: {
            findUnique: async () => ({
              id: 'ptx_baixo',
              status: 'CAPTURED',
              amountCents: 500, // menor que os 2000 do totalCents do request
              metadata: { recipientPaymentRequestId: 'req_1' },
            }),
          },
        }),
      ),
    );

    const result = await processRecipientPayment('tok_1', 'PIX', 'ptx_baixo');

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /valor/i);
    assert.equal(createShipmentCalls, 0, 'valor insuficiente não pode liberar o shipment');
  });

  it('rejeita quando a transação já foi utilizada para liberar outro shipment (reuso)', async () => {
    const { processRecipientPayment } = loadService();
    createShipmentCalls = 0;

    setPrisma((cb) =>
      cb(
        fakeTx({
          paymentTransaction: {
            findUnique: async () => ({
              id: 'ptx_usada',
              status: 'CAPTURED',
              amountCents: 2000,
              metadata: { recipientPaymentRequestId: 'req_1', shipmentId: 'shp_outro' }, // já consumida
            }),
          },
        }),
      ),
    );

    const result = await processRecipientPayment('tok_1', 'PIX', 'ptx_usada');

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /já foi utilizado/i);
    assert.equal(createShipmentCalls, 0, 'transação já consumida não pode liberar um segundo shipment');
  });

  it('quando o request já está PAID, retorna sucesso idempotente sem criar um novo shipment', async () => {
    const { processRecipientPayment } = loadService();
    createShipmentCalls = 0;

    setPrisma((cb) =>
      cb(
        fakeTx({
          recipientPaymentRequest: {
            findUnique: async () => baseRequestRow({ status: 'PAID', shipmentId: 'shp_ja_criado' }),
            update: async () => ({}),
            updateMany: async () => ({ count: 0 }), // não deveria nem ser chamado, mas por garantia
          },
          // Não deveria nem chegar a consultar a transação: request já resolvido.
          paymentTransaction: {
            findUnique: async () => {
              throw new Error('não deveria consultar a transação quando o request já está PAID');
            },
          },
        }),
      ),
    );

    const result = await processRecipientPayment('tok_1', 'PIX', 'ptx_qualquer');

    assert.equal(result.success, true);
    assert.equal(result.shipmentId, 'shp_ja_criado');
    assert.equal(createShipmentCalls, 0, 'request já PAID não pode criar um segundo shipment');
  });

  it('libera e cria o shipment quando CAPTURED, com vínculo e valor corretos', async () => {
    const { processRecipientPayment } = loadService();
    createShipmentCalls = 0;
    let updatedTransactionMetadata: unknown;
    let claimWhere: unknown;

    setPrisma((cb) =>
      cb(
        fakeTx({
          recipientPaymentRequest: {
            findUnique: async () => baseRequestRow(),
            update: async () => ({}),
            updateMany: async (args: any) => {
              claimWhere = args.where;
              return { count: 1 };
            },
          },
          paymentTransaction: {
            findUnique: async () => ({
              id: 'ptx_ok',
              status: 'CAPTURED',
              amountCents: 2000,
              metadata: { recipientPaymentRequestId: 'req_1' },
            }),
            update: async ({ data }: any) => {
              updatedTransactionMetadata = data.metadata;
              return { id: 'ptx_ok', ...data };
            },
          },
        }),
      ),
    );

    const result = await processRecipientPayment('tok_1', 'PIX', 'ptx_ok');

    assert.equal(result.success, true);
    assert.equal(result.shipmentId, 'shp_new');
    assert.equal(createShipmentCalls, 1, 'pagamento aprovado precisa criar exatamente um shipment');
    assert.deepEqual(claimWhere, { id: 'req_1', status: 'PENDING' }, 'o claim precisa ser condicional ao status PENDING');
    assert.deepEqual(
      updatedTransactionMetadata,
      { recipientPaymentRequestId: 'req_1', shipmentId: 'shp_new' },
      'a transação precisa ser marcada como consumida com o shipmentId criado',
    );
  });

  it('duas chamadas em corrida: a segunda vê o claim condicional retornar count 0 e rejeita', async () => {
    const { processRecipientPayment } = loadService();
    createShipmentCalls = 0;
    let claimed = false;

    setPrisma((cb) =>
      cb(
        fakeTx({
          recipientPaymentRequest: {
            findUnique: async () => baseRequestRow(),
            update: async () => ({}),
            updateMany: async (args: any) => {
              if (!claimed && args.where.status === 'PENDING') {
                claimed = true;
                return { count: 1 };
              }
              return { count: 0 }; // outra chamada já reivindicou o request
            },
          },
          paymentTransaction: {
            findUnique: async () => ({
              id: 'ptx_race',
              status: 'CAPTURED',
              amountCents: 2000,
              metadata: { recipientPaymentRequestId: 'req_1' },
            }),
            update: async ({ data }: any) => ({ id: 'ptx_race', ...data }),
          },
        }),
      ),
    );

    const [first, second] = await Promise.all([
      processRecipientPayment('tok_1', 'PIX', 'ptx_race'),
      processRecipientPayment('tok_1', 'PIX', 'ptx_race'),
    ]);

    const successes = [first, second].filter((r) => r.success);
    const failures = [first, second].filter((r) => !r.success);

    assert.equal(successes.length, 1, 'só uma das duas chamadas concorrentes pode vencer o claim');
    assert.equal(failures.length, 1, 'a outra precisa ser rejeitada, não criar um segundo shipment');
    assert.match(failures[0].error ?? '', /já foi processada/i);
    assert.equal(createShipmentCalls, 1, 'a corrida não pode resultar em dois shipments para o mesmo request');
  });
});
