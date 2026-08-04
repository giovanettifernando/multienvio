import assert from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import { createRequire } from 'node:module';

// account-cards.service.ts -> @/platform/db/db (Prisma real, conexão de banco
// no escopo do módulo) e @/platform/crypto/card-vault (que importa
// 'server-only', via @/platform/api/errors -> @/platform/db/db também). Sob
// node --test (CommonJS puro, fora do bundler do Next.js) isso lança/quebra
// no import estático. Mesmo padrão de stub usado em
// tests/unit/asaas/tracking.test.ts (Task 3/7): stub via require.cache de
// 'server-only' e platform/db/db.ts ANTES de carregar o módulo sob teste, com
// createRequire — e sem NENHUM `import` estático (nem de ApiError, nem do
// serviço) no topo do arquivo, porque o TypeScript compila `import` para
// `require()` içado para o topo do módulo compilado, executado antes de
// qualquer stub poder ser instalado.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ERRORS_PATH = path.resolve(ROOT, 'platform/api/errors.ts');
const SERVICE_PATH = path.resolve(ROOT, 'modules/auth/application/account-cards.service.ts');

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: {} } } as any;
}

test.before(() => {
  stubModules();
  delete require.cache[ERRORS_PATH];
  delete require.cache[SERVICE_PATH];
});

function loadService() {
  return req(SERVICE_PATH) as typeof import('@/modules/auth/application/account-cards.service');
}

function loadApiError() {
  return (req(ERRORS_PATH) as typeof import('@/platform/api/errors')).ApiError;
}

const keyBuffer = Buffer.from('a'.repeat(32));

function makeDeps(overrides: any = {}) {
  const tx: any = {
    card: {
      findMany: async () => [],
      count: async () => 0,
      findUnique: async () => null,
      findUniqueOrThrow: async ({ where }: any) => ({ id: where.id, userId: 'u1', isDefault: true, createdAt: new Date() }),
      findFirst: async () => null,
      updateMany: async () => ({}),
      create: async ({ data }: any) => ({ id: 'c1', createdAt: new Date(), ...data }),
      update: async ({ data }: any) => ({ id: 'c1', createdAt: new Date(), ...data }),
      delete: async () => ({}),
    },
    address: { create: async ({ data }: any) => ({ id: 'addr1', ...data }) },
    $transaction: async (fn: any) => fn(tx),
  };
  const prisma = overrides.prisma ?? tx;
  return {
    prisma,
    loadVaultKey: () => keyBuffer,
    appEnv: 'test',
    logger: undefined,
    ...overrides,
  };
}

test.describe('services/account-cards', () => {
  test('cria cartão com pan cifrado e marca default', async () => {
    const service = loadService();
    const deps = makeDeps();
    const result = await service.createUserCard('u1', {
      pan: '4111111111111111',
      brand: 'VISA',
      holderName: 'USER NAME',
      expMonth: 12,
      expYear: new Date().getUTCFullYear() + 1,
      last4: '1111',
      billingAddress: {
        cep: '12345678',
        logradouro: 'Rua',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Cidade',
        uf: 'SP',
        complemento: null,
        label: null,
      },
      requestDefault: true,
    }, deps);
    assert.strictEqual(result.holderName, 'USER NAME');
    assert.ok(result.billingAddressId);
    assert.strictEqual(result.isDefault, true);
  });

  test('updateCard valida expiração', async () => {
    const service = loadService();
    const prismaTx: any = {
      card: {
        findUnique: async () => ({ id: 'c1', userId: 'u1', expMonth: 1, expYear: 2030, holderName: 'OLD', isDefault: false, fingerprint: '123-456-2030-01' }),
        findFirst: async () => null,
        update: async ({ data }: any) => ({ id: 'c1', createdAt: new Date(), ...data }),
        updateMany: async () => ({}),
        findUniqueOrThrow: async ({ where }: any) => ({ id: where.id, userId: 'u1', isDefault: false, expMonth: 11, expYear: new Date().getUTCFullYear() + 1, fingerprint: '123-456-2030-01', createdAt: new Date() }),
      },
    };
    prismaTx.$transaction = async (fn: any) => fn(prismaTx);
    const deps = makeDeps({ prisma: prismaTx });
    const updated = await service.updateUserCard('u1', 'c1', { expMonth: 11, expYear: new Date().getUTCFullYear() + 1 }, deps);
    assert.strictEqual(updated.expMonth, 11);
  });

  test('removeCard falha se não encontrado', async () => {
    const service = loadService();
    const ApiError = loadApiError();
    const prismaTx: any = {
      card: {
        findUnique: async () => null,
        delete: async () => ({}),
        update: async () => ({}),
      },
    };
    prismaTx.$transaction = async (fn: any) => fn(prismaTx);
    const deps = makeDeps({ prisma: prismaTx });
    await assert.rejects(() => service.deleteUserCard('u1', 'c1', deps), ApiError);
  });
});

// createUserCardFromAsaasToken: sem endpoint de "salvar no cofre" no Asaas, o
// token da tokenização é persistido diretamente. O ponto sensível é a mesma
// mitigação de corrida usada em createAsaasPaymentWithTracking ao persistir
// asaasCustomerId — coberta aqui porque não existia teste antes da conversão.
function makeAsaasCardDeps(overrides: {
  userOverrides?: Record<string, unknown>;
  updateMany?: (args: any) => Promise<{ count: number }>;
  findUniqueOrThrow?: () => Promise<any>;
} = {}) {
  const cards: any[] = [];
  const updateManyCalls: any[] = [];
  const userState: Record<string, unknown> = {
    id: 'u1',
    name: 'User Name',
    email: 'user@test.dev',
    cpf: '12345678909',
    phone: null,
    asaasCustomerId: null,
    ...overrides.userOverrides,
  };

  const prisma: any = {
    user: {
      findUniqueOrThrow: overrides.findUniqueOrThrow ?? (async () => ({ ...userState })),
      updateMany:
        overrides.updateMany ??
        (async (args: any) => {
          // Captura o argumento completo (where + data) para o teste poder
          // inspecionar a condição atômica, não só decidir count via estado
          // mutável — é o `where` que torna a operação segura no Postgres.
          updateManyCalls.push(args);
          if (userState.asaasCustomerId === null) {
            userState.asaasCustomerId = args.data.asaasCustomerId;
            return { count: 1 };
          }
          return { count: 0 };
        }),
    },
    card: {
      findFirst: async ({ where }: any) =>
        cards.find((c) => c.userId === where.userId && c.fingerprint === where.fingerprint) ?? null,
      count: async ({ where }: any) => cards.filter((c) => c.userId === where.userId).length,
      create: async ({ data }: any) => {
        const card = { id: `c${cards.length + 1}`, createdAt: new Date(), billingAddressId: null, ...data };
        cards.push(card);
        return card;
      },
      update: async ({ where, data }: any) => {
        const card = cards.find((c) => c.id === where.id);
        Object.assign(card, data);
        return card;
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  };

  return { prisma, cards, userState, updateManyCalls };
}

test.describe('services/account-cards - createUserCardFromAsaasToken', () => {
  test('cria cliente Asaas e salva o token da tokenização como cartão default', async () => {
    const service = loadService();
    const deps = makeAsaasCardDeps();
    const card = await service.createUserCardFromAsaasToken(
      'u1',
      {
        token: 'card_tok_abcdef01',
        brand: 'visa',
        last4: '4242',
        holderName: 'USER NAME',
        expMonth: 12,
        expYear: new Date().getFullYear() + 1,
      },
      { prisma: deps.prisma, getOrCreateCustomer: async () => ({ id: 'cus_new' }) },
    );

    assert.strictEqual(card.brand, 'VISA');
    assert.strictEqual(card.isDefault, true);
    assert.strictEqual(deps.userState.asaasCustomerId, 'cus_new');

    // Important 2 (revisão fix round 2): não basta o resultado final bater —
    // é o próprio `where` da atualização condicional que precisa exigir
    // `asaasCustomerId: null`. Sem isso, a "mitigação de corrida" é só
    // decoração: um `updateMany` sem essa condição sobrescreveria sem checar
    // se outra execução já gravou primeiro.
    assert.strictEqual(deps.updateManyCalls.length, 1);
    assert.strictEqual(deps.updateManyCalls[0].where.id, 'u1');
    assert.strictEqual(
      deps.updateManyCalls[0].where.asaasCustomerId,
      null,
      'updateMany precisa condicionar a gravação a asaasCustomerId ainda vazio',
    );
    assert.strictEqual(deps.updateManyCalls[0].data.asaasCustomerId, 'cus_new');
  });

  test('perde a corrida de criação do cliente e converge para o customerId já persistido', async () => {
    const service = loadService();
    let reads = 0;
    const deps = makeAsaasCardDeps({
      updateMany: async () => ({ count: 0 }), // outra execução já gravou primeiro
      findUniqueOrThrow: async () => {
        reads += 1;
        // 1ª leitura (início da função): usuário ainda sem customerId.
        if (reads === 1) {
          return { id: 'u1', name: 'User Name', email: 'user@test.dev', cpf: '12345678909', phone: null, asaasCustomerId: null };
        }
        // Releitura após perder a corrida: já existe um customerId persistido
        // por outra execução concorrente.
        return { id: 'u1', name: 'User Name', email: 'user@test.dev', cpf: '12345678909', phone: null, asaasCustomerId: 'cus_concorrente' };
      },
    });

    const card = await service.createUserCardFromAsaasToken(
      'u1',
      {
        token: 'card_tok_ghijkl02',
        brand: 'mastercard',
        last4: '1111',
        holderName: 'OUTRO USER',
        expMonth: 6,
        expYear: new Date().getFullYear() + 2,
      },
      { prisma: deps.prisma, getOrCreateCustomer: async () => ({ id: 'cus_perdedor' }) },
    );

    assert.ok(card.id);
    assert.strictEqual(reads, 2);
  });

  test('reenvio do mesmo token atualiza o cartão existente em vez de duplicar', async () => {
    const service = loadService();
    const deps = makeAsaasCardDeps({ userOverrides: { asaasCustomerId: 'cus_existente' } });
    const input = {
      token: 'card_tok_zzzzzzzz',
      brand: 'visa',
      last4: '4242',
      holderName: 'USER NAME',
      expMonth: 12,
      expYear: new Date().getFullYear() + 1,
    };
    const getOrCreateCustomer = async () => ({ id: 'cus_existente' });

    const first = await service.createUserCardFromAsaasToken('u1', input, { prisma: deps.prisma, getOrCreateCustomer });
    const second = await service.createUserCardFromAsaasToken('u1', input, { prisma: deps.prisma, getOrCreateCustomer });

    assert.strictEqual(first.id, second.id);
    assert.strictEqual(deps.cards.length, 1);
  });

  test('não existe chamada remota de exclusão: deleteUserCard só apaga o registro local', async () => {
    const service = loadService();
    const prismaTx: any = {
      card: {
        findUnique: async () => ({ id: 'c1', userId: 'u1', isDefault: false }),
        delete: async () => ({}),
        update: async () => ({}),
      },
    };
    prismaTx.$transaction = async (fn: any) => fn(prismaTx);
    const deps = makeDeps({ prisma: prismaTx });
    await assert.doesNotReject(() => service.deleteUserCard('u1', 'c1', deps));
  });
});
