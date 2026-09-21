import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/auth/logout/route';
import { staffSessionCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute } from '../../../../../../_setup/test-helpers';

function logout(headers: Record<string, string> = {}) {
  return callRoute(POST as any, apiRequest('/api/admin/auth/logout', { method: 'POST', headers }));
}

test.describe('app/api/admin/auth/logout', () => {
  test.beforeEach(() => {
    test.mock.method(staffSessionCache, 'incrementTokenVersion', async () => 2);
    test.mock.method(staffSessionCache, 'closeDevice', async () => true);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('bloqueia logout disparado por outro site (CSRF)', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession());
    const res = await logout({ origin: 'https://site-malicioso.com', host: 'test' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual((staffSessionCache.incrementTokenVersion as any).mock.callCount(), 0);
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await logout();
    assert.strictEqual(res.status, 401);
  });

  test('encerra só este aparelho e apaga o cookie', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession({ staffId: 's9', sid: 'painel-2' }));

    const res = await logout();

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual((staffSessionCache.closeDevice as any).mock.calls[0].arguments, ['s9', 'painel-2']);
    assert.strictEqual((staffSessionCache.incrementTokenVersion as any).mock.callCount(), 0);
    assert.match(res.headers.get('set-cookie') ?? '', /Max-Age=0/i);
  });

  test('token de antes da sessão por aparelho: revoga tudo e apaga o cookie', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession({ staffId: 's9' }));

    const res = await logout();

    assert.strictEqual(res.status, 200);
    assert.strictEqual((staffSessionCache.incrementTokenVersion as any).mock.calls[0].arguments[0], 's9');
    const cookie = res.headers.get('set-cookie') ?? '';
    assert.ok(cookie.startsWith(`${adminSessionModule.ADMIN_AUTH_COOKIE_NAME}=`));
    assert.match(cookie, /Max-Age=0|Expires=Thu, 01 Jan 1970/i, 'o cookie precisa sair do navegador');
  });

  test('responde 500 se não conseguir revogar', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession());
    test.mock.method(staffSessionCache, 'incrementTokenVersion', async () => {
      throw new Error('redis fora');
    });
    const res = await logout();
    assert.strictEqual(res.status, 500);
  });
});
