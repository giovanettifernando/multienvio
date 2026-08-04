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

function cartItemFixture(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

// IMPORTANTE (achado da revisão): um merge raso no nível de "paymentTransaction"
// apagava métodos que o override não repetia — um teste que só fornecia
// `findUnique` deixava `update`/`updateMany` undefined; quando o fluxo
// alcançava essa chamada (mesmo com a checagem de dono REMOVIDA de propósito),
// o TypeError "... is not a function" era capturado por `assert.rejects` como
// se fosse a rejeição esperada — falso positivo que não pega sabotagem
// nenhuma. Por isso o merge abaixo é por SUB-OBJETO: cada área tem seus
// próprios defaults preenchidos, e um override parcial de uma área não apaga
// os métodos das outras chaves que a área não menciona.
function fakeTx(overrides: {
  walletTransaction?: Record<string, unknown>;
  trackingCodeReservation?: Record<string, unknown>;
  cart?: Record<string, unknown>;
  cartItem?: Record<string, unknown>;
  label?: Record<string, unknown>;
  pickupRequest?: Record<string, unknown>;
  user?: Record<string, unknown>;
  paymentTransaction?: Record<string, unknown>;
} = {}) {
  return {
    walletTransaction: {
      findUnique: async () => null, // não idempotente
      ...overrides.walletTransaction,
    },
    trackingCodeReservation: {
      findMany: async () => [{ code: 'EL1' }],
      updateMany: async () => ({ count: 1 }),
      ...overrides.trackingCodeReservation,
    },
    cart: {
      findFirst: async () => ({ id: 'cart_1', items: [cartItemFixture()] }),
      update: async () => ({}),
      ...overrides.cart,
    },
    cartItem: {
      deleteMany: async () => ({}),
      count: async () => 0,
      ...overrides.cartItem,
    },
    label: {
      create: async ({ data }: any) => ({ id: `lbl_${data.trackingCode}`, ...data }),
      ...overrides.label,
    },
    pickupRequest: {
      findUnique: async () => null,
      create: async ({ data }: any) => ({ id: 'pr_1', ...data }),
      ...overrides.pickupRequest,
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
      ...overrides.user,
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
    reservedTrackingCodes: ['EL1'],
    itemIds: ['item_1'],
    paymentMethod: 'PAGARME' as const,
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

describe('createCartShipmentsWithPayment — gate de liberação do pagamento do gateway', () => {
  it('rejeita quando a transação pertence a outro usuário (dono) — pela checagem certa, não por mock incompleto', async () => {
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
      assertNotApproved,
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
      assertNotApproved,
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
      assertNotApproved,
    );
  });

  it('rejeita quando o claim atômico não vence (transação já reivindicada/consumida)', async () => {
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
      createCartShipmentsWithPayment(baseInput({ pagarmePaymentId: 'ptx_4' })),
      assertAlreadyUsed,
    );
  });

  it('libera e cria os envios quando CAPTURED, do próprio usuário e com valor correto', async () => {
    const { createCartShipmentsWithPayment } = loadService();
    let claimCall: unknown;
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
              updateMany: async (args: any) => {
                claimCall = args;
                return { count: 1 };
              },
            },
          }),
        ),
    };

    const result = await createCartShipmentsWithPayment(baseInput({ pagarmePaymentId: 'ptx_5' }));

    assert.deepEqual(result.shipmentIds, ['shp_EL1']);
    assert.equal(result.isIdempotent, false);
    assert.deepEqual(
      claimCall,
      {
        where: { id: 'ptx_5', consumedByReference: null },
        data: { consumedByReference: 'cart:EL1' },
      },
      'o claim usa a condição consumedByReference: null e grava a referência deste checkout',
    );
  });

  it('SABOTAGEM: sob concorrência, exatamente uma chamada libera — a outra é rejeitada pelo claim atômico', async () => {
    const { createCartShipmentsWithPayment } = loadService();
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
      $transaction: async (cb: any) =>
        cb(
          fakeTx({
            trackingCodeReservation: {
              findMany: async (args: any) =>
                (args.where.code.in as string[]).map((code: string) => ({ code })),
              updateMany: async () => ({ count: 1 }),
            },
            cart: {
              findFirst: async () => ({ id: 'cart_1', items: [cartItemFixture()] }),
              update: async () => ({}),
            },
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
      createCartShipmentsWithPayment(
        baseInput({ pagarmePaymentId: 'ptx_race', reservedTrackingCodes: ['EL_RACE_A'] }),
      ),
      createCartShipmentsWithPayment(
        baseInput({ pagarmePaymentId: 'ptx_race', reservedTrackingCodes: ['EL_RACE_B'] }),
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'exatamente uma chamada deve liberar os envios');
    assert.equal(rejected.length, 1, 'a outra deve ser rejeitada pelo claim atômico');
    assertAlreadyUsed((rejected[0] as PromiseRejectedResult).reason);

    assert.equal(calls.length, 2, 'as duas chamadas devem ter tentado o claim');
    for (const call of calls) {
      assert.equal(call.where.id, 'ptx_race');
      assert.equal(call.where.consumedByReference, null, 'o claim precisa condicionar no WHERE consumedByReference: null');
    }
  });
});
