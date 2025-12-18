import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { PUT } from '@/app/api/admin/ops/pocs/[id]/route';

function makeRequest(body: unknown) {
  return new Request('http://test/api/admin/ops/pocs/p1', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

test.describe('app/api/admin/ops/pocs/[id]', () => {
  let sessionModule: any;
  let permissionsModule: any;
  let rateLimitModule: any;
  let seedModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../../../lib/auth/admin-session.ts');
    permissionsModule = await import('../../../../../../../../lib/auth/permissions.ts');
    rateLimitModule = await import('../../../../../../../../lib/rate-limit.ts');
    seedModule = await import('../../../../../../../../lib/admin/ops/mockSeed.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => null);

    const res = await PUT(makeRequest({ name: 'Novo' }), { params: Promise.resolve({ id: 'p1' }) } as any);
    assert.strictEqual(res.status, 401);
  });

  test('retorna 403 quando falta permissão', async () => {
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

    const res = await PUT(makeRequest({ name: 'Novo' }), { params: Promise.resolve({ id: 'p1' }) } as any);
    assert.strictEqual(res.status, 403);
  });

  test('respeita rate limit', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: ['OPERACOES'],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, 'requirePermission', () => null);
    test.mock.method(
      rateLimitModule,
      'rateLimitByUser',
      () => NextResponse.json({ message: 'Limite atingido' }, { status: 429 })
    );

    const res = await PUT(makeRequest({ name: 'Novo' }), { params: Promise.resolve({ id: 'p1' }) } as any);
    assert.strictEqual(res.status, 429);
  });

  test('atualiza PoC com sucesso', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: ['OPERACOES'],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, 'requirePermission', () => null);
    test.mock.method(rateLimitModule, 'rateLimitByUser', () => null);

    let updatedPoC: any;
    test.mock.method(seedModule, 'updatePoCs', (updater: (pocs: any[]) => any[]) => {
      const next = updater([{ id: 'p1', name: 'Old', active: true }]);
      updatedPoC = next[0];
    });

    const res = await PUT(makeRequest({ active: false, name: 'Atualizado' }), {
      params: Promise.resolve({ id: 'p1' }),
    } as any);

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { ok: true });
    assert.strictEqual(updatedPoC.id, 'p1');
    assert.strictEqual(updatedPoC.name, 'Atualizado');
    assert.strictEqual(updatedPoC.active, false);
  });
});
