import assert from 'node:assert';
import test from 'node:test';
import * as service from '@/modules/auth/application/account-recipients.service';

test.describe('services/account-recipients', () => {
  test('cria recipient e marca default quando solicitado', async () => {
    const txCalls: string[] = [];
    const recipient = { id: 'r1', isDefault: false } as any;
    const prismaMock: any = {
      recipient: {
        findFirst: async () => null,
        findMany: async () => [],
        count: async () => 1,
        create: async ({ data }: any) => ({ ...recipient, ...data }),
        updateMany: async () => {
          txCalls.push('unsetDefault');
          return { count: 1 };
        },
      },
      $transaction: async (fn: any) => fn(prismaMock),
    };

    const created = await service.createRecipient('u1', {
      name: 'Rec',
      email: null,
      document: null,
      phone: null,
      notes: null,
      isDefault: true,
      cep: '123',
      logradouro: 'Rua',
      numero: '10',
      complemento: null,
      bairro: 'Centro',
      cidade: 'Cidade',
      uf: 'SP',
    } as any, { prisma: prismaMock });

    assert.strictEqual(created.isDefault, true);
    assert.ok(txCalls.includes('unsetDefault'));
  });

  test('listRecipients aplica filtros', async () => {
    const prismaMock: any = {
      recipient: {
        count: async () => 1,
        findMany: async (args: any) => [{ id: 'r1', name: args.where.OR ? 'Match' : 'Other', cep: '1', logradouro: 'l', numero: '1', bairro: 'b', cidade: 'c', uf: 'SP', email: null, document: null, phone: null, notes: null, isDefault: false, complemento: null, createdAt: new Date(), updatedAt: new Date() }],
      },
    };
    const res = await service.listRecipients('u1', { q: 'Match', page: 1, pageSize: 10 }, { prisma: prismaMock });
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.items[0].name, 'Match');
  });
});
