import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/auth/refresh/route';
import { staffSessionCache } from '@/platform/cache/cache';
import { adminSign, adminVerify, ADMIN_AUTH_COOKIE_NAME } from '@/modules/auth/application/admin-session';
import { apiRequest } from '../../../../../../_setup/test-helpers';

async function renovar(extra: Record<string, unknown> = {}) {
  const token = await adminSign({
    staffId: 's1', email: 'staff@x.com', role: 'operator', isSuperAdmin: false, permissions: ['OPERACOES'], tokenVersion: 5, sid: 'painel-1', ...extra,
  } as any);
  return POST(apiRequest('/api/admin/auth/refresh', { method: 'POST', headers: { cookie: `${ADMIN_AUTH_COOKIE_NAME}=${token}` } }));
}

function cookie(res: Response, nome: string) {
  const c = res.headers.getSetCookie().find((v) => v.startsWith(`${nome}=`));
  return c ? decodeURIComponent(c.split(';')[0].slice(nome.length + 1)) : undefined;
}

test.describe('app/api/admin/auth/refresh', () => {
  test.beforeEach(() => {
    test.mock.method(staffSessionCache, 'getTokenVersion', async () => 5);
    test.mock.method(staffSessionCache, 'get', async () => ({ staffId: 's1', status: 'ACTIVE', tokenVersion: 5 }));
    test.mock.method(staffSessionCache, 'hasDevice', async () => true);
    test.mock.method(staffSessionCache, 'touchDevice', async () => true);
    test.mock.method(staffSessionCache, 'touch', async () => true);
    test.mock.method(staffSessionCache, 'incrementTokenVersion', async () => 6);
  });

  test.afterEach(() => test.mock.restoreAll());

  test('renova sem mexer na versão e mantém o aparelho', async () => {
    const res = await renovar();

    assert.strictEqual(res.status, 200);
    assert.strictEqual((staffSessionCache.incrementTokenVersion as any).mock.callCount(), 0);
    const { payload } = await adminVerify(cookie(res, ADMIN_AUTH_COOKIE_NAME)!);
    assert.strictEqual(payload?.tokenVersion, 5);
    assert.strictEqual(payload?.sid, 'painel-1');
    assert.deepStrictEqual(payload?.permissions, ['OPERACOES']);
  });

  test('aparelho que saiu não renova', async () => {
    test.mock.method(staffSessionCache, 'touchDevice', async () => false);
    const res = await renovar();
    assert.strictEqual(res.status, 401);
  });
});
