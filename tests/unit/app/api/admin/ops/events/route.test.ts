import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/admin/ops/events/route';

function makeRequest(url = 'http://test/api/admin/ops/events') {
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
    method: 'GET',
  } as any;
}

test.describe('app/api/admin/ops/events', () => {
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

  test('lista eventos paginados e filtra processed', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: ['OPERACOES'],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, 'requirePermission', () => null);
    test.mock.method(seedModule, 'getSeed', () => ({
      events: [
        { id: 'evt_1', processed: true, source: 'manual', retries: 0, lastError: null },
        { id: 'evt_2', processed: false, source: 'carrier_webhook', retries: 1, lastError: 'err' },
      ],
      shipments: [],
      pocs: [],
      pickups: [],
      exceptions: [],
    }));

    const res = await GET(makeRequest('http://test/api/admin/ops/events?page=1&pageSize=1&processed=true'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.items.map((i: any) => i.id), ['evt_1']);
    assert.strictEqual(body.total, 1);
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.pageSize, 1);
  });
});
