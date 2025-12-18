import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/admin/ops/collectors/route';
import prisma from '@/platform/db/db';

function makeRequest() {
  return {
    method: 'GET',
    headers: new Headers(),
    nextUrl: new URL('http://test/api/admin/ops/collectors'),
  } as any;
}

const originalCollector = prisma.collector;

test.describe('app/api/admin/ops/collectors', () => {
  let sessionModule: any;
  let permissionsModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../../lib/auth/admin-session.ts');
    permissionsModule = await import('../../../../../../../lib/auth/permissions.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.collector = originalCollector;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => null);

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 401);
  });

  test('retorna 403 sem permissão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: [],
      isSuperAdmin: false,
    }));
    test.mock.method(
      permissionsModule,
      'requirePermission',
      () => NextResponse.json({ message: 'Sem permissão' }, { status: 403 })
    );

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 403);
  });

  test('retorna 500 quando prisma falha', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: ['OPERACOES'],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, 'requirePermission', () => null);
    prisma.collector = {
      findMany: async () => {
        throw new Error('db down');
      },
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 500);
  });

  test('lista coletores ativos', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: ['OPERACOES'],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, 'requirePermission', () => null);
    prisma.collector = {
      findMany: async () => [
        { id: 'c1', pfNome: 'Ana', pfCelular: '999', pfCidade: 'SP', pfUf: 'SP', status: 'ACTIVE' },
        { id: 'c2', pfNome: 'Bruno', pfCelular: '888', pfCidade: 'RJ', pfUf: 'RJ', status: 'ACTIVE' },
      ],
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, [
      { id: 'c1', name: 'Ana', phone: '999', city: 'SP', uf: 'SP' },
      { id: 'c2', name: 'Bruno', phone: '888', city: 'RJ', uf: 'RJ' },
    ]);
  });
});
