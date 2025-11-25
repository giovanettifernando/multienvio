import assert from 'node:assert';
import test from 'node:test';
import { ApiError } from '../../../lib/api/errors.ts';
import * as service from '../../../lib/services/account-cards.service.ts';

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
