import assert from 'node:assert';
import test from 'node:test';
import { Decimal } from '@prisma/client/runtime/client';
import { prisma } from '../../../lib/db.ts';
import * as service from '../../../lib/services/packaging.ts';

const original = {
  packagingTemplate: prisma.packagingTemplate,
};

test.describe('services/packaging', () => {
  test.afterEach(() => {
    prisma.packagingTemplate = original.packagingTemplate;
  });

  test('create gera nome automático quando ausente', async () => {
    const created: any[] = [];
    prisma.packagingTemplate = {
      create: async ({ data }: any) => {
        created.push(data);
        return { id: '1', ...data } as any;
      },
    } as any;

    const result = await service.create('user1', {
      name: undefined,
      lengthCm: 10,
      widthCm: 5.5,
      heightCm: 3,
    } as any);

    assert.ok(result.name?.startsWith('C (10)'));
    assert.ok(created[0].lengthCm instanceof Decimal);
  });

  test('update falha para embalagem inexistente', async () => {
    prisma.packagingTemplate = {
      findFirst: async () => null,
      update: async () => {
        throw new Error('should not call');
      },
    } as any;

    await assert.rejects(() => service.update('user1', 'id1', {} as any));
  });

  test('update aplica campos parciais e remove usa verificação de ownership', async () => {
    let deleted = false;
    const existing = { id: 'id1', userId: 'user1' };
    prisma.packagingTemplate = {
      findFirst: async () => existing,
      update: async ({ data }: any) => ({ ...existing, ...data }),
      delete: async () => {
        deleted = true;
      },
    } as any;

    const updated = await service.update('user1', 'id1', { widthCm: 9 } as any);
    assert.strictEqual((updated as any).widthCm instanceof Decimal, true);

    await service.remove('user1', 'id1');
    assert.strictEqual(deleted, true);
  });
});
