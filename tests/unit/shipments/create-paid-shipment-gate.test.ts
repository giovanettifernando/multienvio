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
const COMMISSION_PATH = path.resolve(ROOT, 'modules/quotes/application/commission.ts');
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
  // Comissões leem a configuração da transportadora no banco.
  stubModule(COMMISSION_PATH, {
    calculateCommissionsInCents: async () => ({ shippingCommissionCents: 0 }),
    calculateInsuranceCommission: async () => ({ commissionAmount: 0 }),
    resolveCarrierSlugByName: () => 'correios',
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

// Declaração exige remetente com CPF/CNPJ e chave de DC-e válida e ainda não
// usada — checagens feitas antes da transação, direto no prisma.
const CHAVE_DCE = '41260912345678000195990010000000421011234561';
const foraDaTransacao = {
  user: { findUnique: async () => ({ cpf: '12345678900', cnpj: null }) },
  shipment: { findUnique: async () => null },
};

const baseVolumes = [{ peso: 1, altura: 10, largura: 10, comprimento: 10 }];

// IMPORTANTE (achado da revisão): um merge raso no nível de "paymentTransaction"
// apagava métodos que o override não repetia — um teste que só fornecia
// `findUnique` deixava `update`/`updateMany` undefined; quando o fluxo
// alcançava essa chamada (mesmo com a checagem de dono REMOVIDA de propósito),
// o TypeError "... is not a function" era capturado por `assert.rejects` como
// se fosse a rejeição esperada — falso positivo que não pega sabotagem
// nenhuma. Por isso o merge abaixo é por SUB-OBJETO: cada área
// (shipment/trackingCodeReservation/label/paymentTransaction) tem seus
// próprios defaults preenchidos, e um override parcial de uma área não apaga
// os métodos das outras chaves que a área não menciona.
function fakeTx(overrides: {
  shipment?: Record<string, unknown>;
  trackingCodeReservation?: Record<string, unknown>;
  label?: Record<string, unknown>;
  paymentTransaction?: Record<string, unknown>;
} = {}) {
  return {
    shipment: {
      findFirst: async () => null, // não idempotente
      ...overrides.shipment,
    },
    trackingCodeReservation: {
      findFirst: async () => ({ code: 'EL123', userId: 'user-1' }), // reserva válida
      updateMany: async () => ({ count: 1 }),
      ...overrides.trackingCodeReservation,
    },
    label: {
      create: async ({ data }: any) => ({ id: 'lbl_1', ...data }),
      ...overrides.label,
    },
    paymentTransaction: {
      findUnique: async () => null,
      // Default do claim: sucesso. Testes que querem simular "já
      // reivindicado por outra requisição" sobrescrevem só isso.
      updateMany: async () => ({ count: 1 }),
      ...overrides.paymentTransaction,
    },
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
    dceKey: CHAVE_DCE,
    ...overrides,
  };
}

function assertNotApproved(err: unknown) {
  assert.ok(err instanceof Error);
  assert.equal((err as any).code, 'PAGARME_PAYMENT_NOT_APPROVED');
  assert.match(err.message, /não encontrado ou não aprovado/);
  return true;
}

function assertAlreadyUsed(err: unknown) {
  assert.ok(err instanceof Error);
  assert.equal((err as any).code, 'PAGARME_PAYMENT_ALREADY_USED');
  assert.match(err.message, /já foi utilizado/);
  return true;
}

describe('createPaidShipment — gate de liberação do pagamento do gateway', () => {
  it('rejeita quando a transação pertence a outro usuário (dono) — pela checagem certa, não por mock incompleto', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      ...foraDaTransacao,
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
      assertNotApproved,
    );
  });

  it('rejeita quando o valor da transação é insuficiente', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      ...foraDaTransacao,
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_2',
                userId: 'user-1',
                status: 'CAPTURED',
                amountCents: 500, // menor que os 2000 (20 * 100) do totalCost
                metadata: null,
              }),
            },
          }),
        ),
    };

    await assert.rejects(
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_2', totalCost: 20 })),
      assertNotApproved,
    );
  });

  it('rejeita enquanto o pagamento está PENDING', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      ...foraDaTransacao,
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
      assertNotApproved,
    );
  });

  it('rejeita quando o claim atômico não vence (transação já reivindicada/consumida)', async () => {
    const { createPaidShipment } = loadService();
    require.cache[DB_PATH]!.exports.prisma = {
      ...foraDaTransacao,
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => ({
                id: 'ptx_4',
                userId: 'user-1',
                status: 'CAPTURED',
                amountCents: 2000,
                metadata: null,
              }),
              // Simula outra requisição/tentativa que já reivindicou a linha
              // (count 0 é exatamente o que o Postgres devolveria).
              updateMany: async () => ({ count: 0 }),
            },
          }),
        ),
    };

    await assert.rejects(
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_4', totalCost: 20 })),
      assertAlreadyUsed,
    );
  });

  it('libera e cria o envio quando CAPTURED, do próprio usuário e com valor correto', async () => {
    const { createPaidShipment } = loadService();
    let claimCall: unknown;
    require.cache[DB_PATH]!.exports.prisma = {
      ...foraDaTransacao,
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
              updateMany: async (args: any) => {
                claimCall = args;
                return { count: 1 };
              },
            },
          }),
        ),
    };

    const result = await createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_5', totalCost: 20 }));

    assert.equal(result.shipmentId, 'shp_new');
    assert.equal(result.isIdempotent, false);
    assert.deepEqual(
      claimCall,
      {
        where: { id: 'ptx_5', consumedByReference: null },
        data: { consumedByReference: 'shipment:EL123' },
      },
      'o claim usa a condição consumedByReference: null e grava a referência deste envio',
    );
  });

  it('SABOTAGEM: sob concorrência, exatamente uma chamada libera — a outra é rejeitada pelo claim atômico', async () => {
    const { createPaidShipment } = loadService();
    let claimed = false;
    const calls: any[] = [];
    const sharedPaymentTx = {
      id: 'ptx_race',
      userId: 'user-1',
      status: 'CAPTURED',
      amountCents: 2000,
      metadata: null,
    };

    require.cache[DB_PATH]!.exports.prisma = {
      ...foraDaTransacao,
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            paymentTransaction: {
              findUnique: async () => sharedPaymentTx,
              // Modela o compare-and-swap real do Postgres derivando o
              // resultado do PRÓPRIO argumento `where` — não apenas de um
              // flag de closure. Isso prova a CONDIÇÃO, não só a propagação
              // do count: se o serviço parar de mandar
              // `consumedByReference: null` no WHERE (ex.: alguém remove essa
              // parte da condição), a chamada "vence" incondicionalmente por
              // casar só no `id` — exatamente o que aconteceria de verdade no
              // Postgres com um UPDATE sem essa cláusula — e a corrida deixa
              // de ser fechada, o que este teste tem que detectar.
              updateMany: async (args: any) => {
                calls.push(args);
                const hasClaimCondition = args.where?.consumedByReference === null;
                if (!hasClaimCondition) {
                  // WHERE sem a condição de claim: casa incondicionalmente
                  // pelo id, então "vence" toda vez — a corrida não é fechada.
                  return { count: 1 };
                }
                if (claimed) return { count: 0 };
                claimed = true;
                return { count: 1 };
              },
            },
          }),
        ),
    };

    const results = await Promise.allSettled([
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_race', totalCost: 20, trackingCode: 'EL_RACE_A' })),
      createPaidShipment(baseInput({ pagarmePaymentId: 'ptx_race', totalCost: 20, trackingCode: 'EL_RACE_B' })),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'exatamente uma chamada deve liberar o envio');
    assert.equal(rejected.length, 1, 'a outra deve ser rejeitada pelo claim atômico');
    assertAlreadyUsed((rejected[0] as PromiseRejectedResult).reason);

    assert.equal(calls.length, 2, 'as duas chamadas devem ter tentado o claim');
    for (const call of calls) {
      assert.equal(call.where.id, 'ptx_race');
      assert.equal(call.where.consumedByReference, null, 'o claim precisa condicionar no WHERE consumedByReference: null');
    }
  });
});
