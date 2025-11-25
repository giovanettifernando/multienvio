import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { POST } from '../../../../../../../../../app/api/admin/ops/events/[id]/retry/route.ts';

function makeRequest() {
  return {
    method: 'POST',
    headers: new Headers(),
    nextUrl: new URL('http://test/api/admin/ops/events/evt_2/retry'),
  } as any;
}

test.describe('app/api/admin/ops/events/[id]/retry', () => {
  let sessionModule: any;
  let permissionsModule: any;
  let seedModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../../../../lib/auth/admin-session.ts');
    permissionsModule = await import('../../../../../../../../../lib/auth/permissions.ts');
    seedModule = await import('../../../../../../../../../lib/admin/ops/mockSeed.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => null);

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'evt_2' }) } as any);
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

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'evt_2' }) } as any);
    assert.strictEqual(res.status, 403);
  });

  test('incrementa retries e limpa erro', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({
      staffId: 's1',
      permissions: ['OPERACOES'],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, 'requirePermission', () => null);

    let calledWithRetry = false;
    test.mock.method(seedModule, 'updateEvents', (updater: (events: any[]) => any[]) => {
      const updated = updater([{ id: 'evt_2', retries: 1, lastError: 'timeout' }]);
      calledWithRetry = updated[0].retries === 2 && updated[0].lastError === null;
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'evt_2' }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { ok: true });
    assert.ok(calledWithRetry);
  });
});
