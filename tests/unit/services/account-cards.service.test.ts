import assert from 'node:assert';
import test from 'node:test';
import { ApiError } from '@/platform/api/errors';
import * as service from '@/modules/auth/application/account-cards.service';

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
        (async ({ data }: any) => {
          if (userState.asaasCustomerId === null) {
            userState.asaasCustomerId = data.asaasCustomerId;
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

  return { prisma, cards, userState };
}

test.describe('services/account-cards - createUserCardFromAsaasToken', () => {
  test('cria cliente Asaas e salva o token da tokenização como cartão default', async () => {
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
  });

  test('perde a corrida de criação do cliente e converge para o customerId já persistido', async () => {
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
