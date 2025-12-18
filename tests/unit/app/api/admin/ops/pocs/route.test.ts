import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/admin/ops/pocs/route';

function makeRequest() {
  return {
    method: 'GET',
    headers: new Headers(),
    nextUrl: new URL('http://test/api/admin/ops/pocs'),
  } as any;
}

test.describe('app/api/admin/ops/pocs', () => {
  let sessionModule: any;
  let permissionsModule: any;
  let seedModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../../lib/auth/admin-session.ts');
    permissionsModule = await import('../../../../../../../lib/auth/permissions.ts');
    seedModule = await import('../../../../../../../lib/admin/ops/mockSeed.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => null);

    const res = await GET(makeRequest());
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

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 403);
  });

  test('retorna lista de PoCs', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: ['OPERACOES'],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, 'requirePermission', () => null);
    test.mock.method(seedModule, 'getSeed', () => ({
      events: [],
      shipments: [],
      pickups: [],
      exceptions: [],
      pocs: [{ id: 'p1', name: 'PoC Centro' }],
    }));

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, [{ id: 'p1', name: 'PoC Centro' }]);
  });
});
