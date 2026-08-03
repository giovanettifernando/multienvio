import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// tracking.ts -> 'server-only' e @/platform/db/db (conexão real com o banco no
// escopo do módulo). Sob node --test (CommonJS puro, fora do bundler do Next.js)
// isso lança/quebra no import estático. Mesmo padrão de stub já usado em
// tests/unit/asaas/cards.test.ts (Task 5) e charges.test.ts (Task 4).
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const TRACKING_PATH = path.resolve(ROOT, 'platform/integrations/asaas/tracking.ts');

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
  delete require.cache[TRACKING_PATH];
});

function loadTracking() {
  return req(TRACKING_PATH) as typeof import('../../../platform/integrations/asaas/tracking');
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  const created: any[] = [];
  const updated: any[] = [];

  return {
    created,
    updated,
    deps: {
      prisma: {
        paymentGateway: { findFirst: async () => ({ id: 'gw_1' }) },
        user: {
          findUniqueOrThrow: async () => ({ id: 'u_1', asaasCustomerId: 'cus_1' }),
          updateMany: async () => ({ count: 1 }),
        },
        paymentTransaction: {
          create: async ({ data }: any) => {
            created.push(data);
            return { id: 'tx_1', ...data };
          },
          update: async ({ data }: any) => {
            updated.push(data);
            return { id: 'tx_1', ...data };
          },
        },
      },
      createCharge: async () => ({
        id: 'pay_1',
        status: 'PENDING',
        billingType: 'PIX',
        value: 49.9,
        netValue: 48.91,
        dueDate: '2026-08-05',
      }),
      getPixQrCode: async () => ({
        success: true,
        payload: '00020101021226820014br.gov.bcb.pix',
        encodedImage: 'iVBORw0KGgo=',
        expirationDate: '2026-08-06 23:59:59',
      }),
      getBoletoIdentification: async () => ({
        identificationField: '46191110000000000000012832971019215320000008990',
        nossoNumero: '12832971',
        barCode: '46192153200000089901110000000000001283297101',
      }),
      getOrCreateCustomer: async () => ({ id: 'cus_1', name: 'Maria' }),
      ...overrides,
    } as never,
  };
}

const input = {
  userId: 'u_1',
  userName: 'Maria',
  userEmail: 'maria@teste.com',
  amountCents: 4990,
  description: 'Envio',
  paymentMethod: 'pix' as const,
  dueDate: '2026-08-05',
  metadata: { type: 'checkout_payment' as const },
};

describe('createAsaasPaymentWithTracking', () => {
  it('registra a transação em centavos e devolve o QR Code do PIX', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    const { deps, created, updated } = makeDeps();
    const result = await createAsaasPaymentWithTracking(input, deps);

    assert.equal(created[0].amountCents, 4990);
    assert.equal(created[0].status, 'PENDING');
    assert.equal(created[0].method, 'PIX');

    assert.equal(updated[0].externalId, 'pay_1');
    assert.equal(updated[0].netCents, 4891, 'netValue convertido para centavos');
    assert.equal(updated[0].feeCents, 99, 'taxa = bruto - líquido');

    assert.equal(result.pixQrCode, '00020101021226820014br.gov.bcb.pix');
    assert.ok(result.pixQrCodeImage?.startsWith('data:image/png;base64,'));
  });

  it('devolve linha digitável e PDF quando é boleto', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    const { deps } = makeDeps({
      createCharge: async () => ({
        id: 'pay_2',
        status: 'PENDING',
        billingType: 'BOLETO',
        value: 89.9,
        netValue: 88.91,
        dueDate: '2026-08-08',
        bankSlipUrl: 'https://sandbox.asaas.com/b/pdf/xyz',
      }),
    });

    const result = await createAsaasPaymentWithTracking(
      { ...input, paymentMethod: 'boleto', amountCents: 8990 },
      deps,
    );

    assert.equal(result.boletoUrl, 'https://sandbox.asaas.com/b/pdf/xyz');
    assert.equal(
      result.boletoBarcode,
      '46191110000000000000012832971019215320000008990',
    );
  });

  it('marca a transação como FAILED quando a cobrança é recusada', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    const { deps, updated } = makeDeps({
      createCharge: async () => {
        throw new Error('Transação não autorizada');
      },
    });

    await assert.rejects(
      () => createAsaasPaymentWithTracking({ ...input, paymentMethod: 'credit_card' }, deps),
      /Transação não autorizada/,
    );
    assert.equal(updated[0].status, 'FAILED');
  });

  // --- Acréscimo obrigatório 1 (revisão da Task 3): mitigação de corrida na
  // criação de cliente. getOrCreateCustomer consulta e cria em duas chamadas
  // separadas (não atômicas); duas execuções concorrentes (duplo clique, retry)
  // podem ambas passar pela consulta antes de qualquer criação terminar e criar
  // dois clientes no Asaas. tracking.ts precisa convergir para um único
  // asaasCustomerId por usuário mesmo nesse cenário.

  it('grava o asaasCustomerId recém-criado quando não há corrida', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    let userReads = 0;
    const updateManyCalls: any[] = [];
    const chargeCalls: any[] = [];

    const { deps } = makeDeps({
      prisma: {
        paymentGateway: { findFirst: async () => ({ id: 'gw_1' }) },
        user: {
          findUniqueOrThrow: async () => {
            userReads += 1;
            return { id: 'u_1', asaasCustomerId: null };
          },
          updateMany: async (args: any) => {
            updateManyCalls.push(args);
            return { count: 1 };
          },
        },
        paymentTransaction: {
          create: async ({ data }: any) => ({ id: 'tx_ok', ...data }),
          update: async ({ data }: any) => ({ id: 'tx_ok', ...data }),
        },
      },
      getOrCreateCustomer: async () => ({ id: 'cus_new', name: 'Maria' }),
      createCharge: async (chargeInput: any) => {
        chargeCalls.push(chargeInput);
        return {
          id: 'pay_ok',
          status: 'PENDING',
          billingType: 'PIX',
          value: 49.9,
          netValue: 48.91,
          dueDate: '2026-08-05',
        };
      },
    });

    await createAsaasPaymentWithTracking(input, deps);

    assert.equal(userReads, 1, 'sem corrida, não precisa reler o usuário');
    assert.equal(updateManyCalls[0].where.asaasCustomerId, null, 'atualização condicional: só grava se ainda estiver vazio');
    assert.equal(updateManyCalls[0].data.asaasCustomerId, 'cus_new');
    assert.equal(chargeCalls[0].customerId, 'cus_new');
  });

  it('usa o asaasCustomerId já gravado quando a atualização condicional perde a corrida', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    let userReads = 0;
    const chargeCalls: any[] = [];

    const { deps } = makeDeps({
      prisma: {
        paymentGateway: { findFirst: async () => ({ id: 'gw_1' }) },
        user: {
          findUniqueOrThrow: async () => {
            userReads += 1;
            // Primeira leitura: usuário ainda sem cliente Asaas.
            // Segunda leitura (após perder a corrida): outra execução já gravou.
            return userReads === 1
              ? { id: 'u_1', asaasCustomerId: null }
              : { id: 'u_1', asaasCustomerId: 'cus_existing' };
          },
          // count 0 simula que outra execução concorrente já gravou o campo primeiro.
          updateMany: async () => ({ count: 0 }),
        },
        paymentTransaction: {
          create: async ({ data }: any) => ({ id: 'tx_race', ...data }),
          update: async ({ data }: any) => ({ id: 'tx_race', ...data }),
        },
      },
      // Mesmo perdendo a corrida, esta execução já criou um cliente no Asaas
      // (cus_new). O sistema deve descartá-lo em favor do que já está persistido.
      getOrCreateCustomer: async () => ({ id: 'cus_new', name: 'Maria' }),
      createCharge: async (chargeInput: any) => {
        chargeCalls.push(chargeInput);
        return {
          id: 'pay_race',
          status: 'PENDING',
          billingType: 'PIX',
          value: 49.9,
          netValue: 48.91,
          dueDate: '2026-08-05',
        };
      },
    });

    await createAsaasPaymentWithTracking(input, deps);

    assert.equal(userReads, 2, 'releu o usuário após a atualização condicional falhar');
    assert.equal(
      chargeCalls[0].customerId,
      'cus_existing',
      'usa o customerId já persistido por outra execução, não o recém-criado',
    );
  });

  // --- Correção do achado CRÍTICO da revisão da Task 7 ---
  // O externalId (id da cobrança no Asaas) era persistido só no update final,
  // DEPOIS de buscar QR Code / linha digitável. Se essas chamadas falhassem, o
  // catch marcava a transação como FAILED sem nunca gravar o externalId — mas a
  // cobrança JÁ EXISTE no Asaas nesse ponto e é pagável (o Asaas notifica o
  // cliente por e-mail com o link, independente do nosso app). O cliente pagava,
  // updatePaymentFromAsaas filtrava por externalId, não casava nada, e o
  // pagamento nunca era refletido: cobrança paga, transação eternamente FAILED,
  // sem nenhuma forma de reconciliar.

  it('persiste o externalId mesmo quando a busca do QR Code do PIX falha', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    const { deps, updated } = makeDeps({
      createCharge: async () => ({
        id: 'pay_orfa',
        status: 'PENDING',
        billingType: 'PIX',
        value: 49.9,
        netValue: 48.91,
        dueDate: '2026-08-05',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_orfa',
      }),
      getPixQrCode: async () => {
        throw new Error('timeout ao buscar QR Code');
      },
    });

    // Não pode lançar: a cobrança existe e é válida.
    const result = await createAsaasPaymentWithTracking(input, deps);

    const comExternalId = updated.find((u: any) => u.externalId === 'pay_orfa');
    assert.ok(comExternalId, 'externalId precisa ter sido persistido');
    assert.notEqual(comExternalId.status, 'FAILED', 'cobrança viva não pode virar FAILED');

    assert.equal(
      updated.some((u: any) => u.status === 'FAILED'),
      false,
      'nenhuma atualização pode marcar FAILED quando a cobrança foi criada com sucesso',
    );

    // Sem QR Code, o cliente ainda tem como pagar pelo link da fatura.
    assert.equal(result.invoiceUrl, 'https://sandbox.asaas.com/i/pay_orfa');
    assert.equal(result.pixQrCode, undefined);
    assert.equal(result.chargeId, 'pay_orfa');
  });

  it('persiste o externalId mesmo quando a busca da linha digitável falha', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    const { deps, updated } = makeDeps({
      createCharge: async () => ({
        id: 'pay_bol',
        status: 'PENDING',
        billingType: 'BOLETO',
        value: 89.9,
        netValue: 88.91,
        dueDate: '2026-08-08',
        bankSlipUrl: 'https://sandbox.asaas.com/b/pdf/xyz',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_bol',
      }),
      getBoletoIdentification: async () => {
        throw new Error('timeout ao buscar linha digitável');
      },
    });

    const result = await createAsaasPaymentWithTracking(
      { ...input, paymentMethod: 'boleto', amountCents: 8990 },
      deps,
    );

    const comExternalId = updated.find((u: any) => u.externalId === 'pay_bol');
    assert.ok(comExternalId, 'externalId precisa ter sido persistido');
    assert.equal(
      updated.some((u: any) => u.status === 'FAILED'),
      false,
      'boleto gerado com sucesso não pode virar FAILED por falha na linha digitável',
    );

    // O PDF vem da própria cobrança, não da chamada que falhou.
    assert.equal(result.boletoUrl, 'https://sandbox.asaas.com/b/pdf/xyz');
    assert.equal(result.boletoBarcode, undefined);
  });

  it('nunca calcula taxa negativa quando o líquido vem maior que o bruto', async () => {
    const { createAsaasPaymentWithTracking } = loadTracking();
    const { deps, updated } = makeDeps({
      createCharge: async () => ({
        id: 'pay_3',
        status: 'PENDING',
        billingType: 'PIX',
        value: 49.9,
        netValue: 60.0, // absurdo, mas não pode gerar feeCents negativo
        dueDate: '2026-08-05',
      }),
    });

    await createAsaasPaymentWithTracking(input, deps);

    const comExternalId = updated.find((u: any) => u.externalId === 'pay_3');
    assert.ok(comExternalId.feeCents >= 0, 'feeCents nunca pode ser negativo');
  });
});

describe('updatePaymentFromAsaas', () => {
  it('sincroniza status, netCents e feeCents a partir da cobrança consultada', async () => {
    const { updatePaymentFromAsaas } = loadTracking();
    const updateManyCalls: any[] = [];

    await updatePaymentFromAsaas('pay_1', {
      prisma: {
        paymentTransaction: {
          updateMany: async (args: any) => {
            updateManyCalls.push(args);
            return { count: 1 };
          },
        },
      },
      getCharge: async () => ({
        id: 'pay_1',
        status: 'RECEIVED',
        billingType: 'PIX',
        value: 49.9,
        netValue: 48.91,
        dueDate: '2026-08-05',
      }),
    } as never);

    assert.equal(updateManyCalls.length, 1);
    assert.deepEqual(updateManyCalls[0].where, { externalId: 'pay_1' });
    assert.equal(updateManyCalls[0].data.status, 'PAID', 'RECEIVED do Asaas vira PAID');
    assert.equal(updateManyCalls[0].data.netCents, 4891);
    assert.equal(updateManyCalls[0].data.feeCents, 99);
  });

  it('não atualiza nada e não lança quando o externalId não casa', async () => {
    const { updatePaymentFromAsaas } = loadTracking();
    let count = -1;

    await updatePaymentFromAsaas('pay_inexistente', {
      prisma: {
        paymentTransaction: {
          updateMany: async () => {
            count = 0;
            return { count: 0 };
          },
        },
      },
      getCharge: async () => ({
        id: 'pay_inexistente',
        status: 'CONFIRMED',
        billingType: 'CREDIT_CARD',
        value: 10,
        dueDate: '2026-08-05',
      }),
    } as never);

    assert.equal(count, 0, 'updateMany foi chamado e não casou nenhuma linha, sem lançar');
  });
});
