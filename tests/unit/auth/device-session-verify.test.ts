import assert from 'node:assert';
import test from 'node:test';
import { sessionCache, staffSessionCache } from '@/platform/cache/cache';
import { signTokenPair } from '@/modules/auth/application/jwt-tokens';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { adminSign, getAdminSessionFromRequest, ADMIN_AUTH_COOKIE_NAME } from '@/modules/auth/application/admin-session';

const comCookie = (nome: string, valor: string) =>
  new Request('http://test/api/x', { headers: { cookie: `${nome}=${valor}` } });

test.describe('token só vale enquanto o aparelho está logado', () => {
  test.beforeEach(() => {
    test.mock.method(sessionCache, 'getTokenVersion', async () => 3);
    test.mock.method(staffSessionCache, 'getTokenVersion', async () => 3);
    test.mock.method(staffSessionCache, 'get', async () => ({ status: 'ACTIVE' }));
  });

  test.afterEach(() => test.mock.restoreAll());

  test('cliente: aparelho aberto passa, aparelho encerrado não', async () => {
    const { accessToken } = await signTokenPair({ userId: 'u1', email: 'a@b.com', role: 'user', tokenVersion: 3, sid: 's-note' });

    test.mock.method(sessionCache, 'hasDevice', async (_u: string, sid: string) => sid === 's-note');
    assert.strictEqual((await getUserFromRequest(comCookie('auth_token', accessToken)))?.userId, 'u1');

    test.mock.method(sessionCache, 'hasDevice', async () => false);
    assert.strictEqual(await getUserFromRequest(comCookie('auth_token', accessToken)), null);
  });

  test('cliente: token antigo, sem aparelho, segue valendo até expirar', async () => {
    const { accessToken } = await signTokenPair({ userId: 'u1', email: 'a@b.com', role: 'user', tokenVersion: 3 });
    const aparelho = test.mock.method(sessionCache, 'hasDevice', async () => false);
    assert.strictEqual((await getUserFromRequest(comCookie('auth_token', accessToken)))?.userId, 'u1');
    assert.strictEqual(aparelho.mock.callCount(), 0);
  });

  test('cliente: bloqueio (versão nova) derruba mesmo com aparelho aberto', async () => {
    const { accessToken } = await signTokenPair({ userId: 'u1', email: 'a@b.com', role: 'user', tokenVersion: 2, sid: 's-note' });
    test.mock.method(sessionCache, 'hasDevice', async () => true);
    assert.strictEqual(await getUserFromRequest(comCookie('auth_token', accessToken)), null);
  });

  test('staff: aparelho encerrado não entra no painel', async () => {
    const token = await adminSign({
      staffId: 's1', email: 'staff@x.com', role: 'operator', isSuperAdmin: false, permissions: [], tokenVersion: 3, sid: 'painel-1',
    });

    test.mock.method(staffSessionCache, 'hasDevice', async (_s: string, sid: string) => sid === 'painel-1');
    assert.strictEqual((await getAdminSessionFromRequest(comCookie(ADMIN_AUTH_COOKIE_NAME, token)))?.staffId, 's1');

    test.mock.method(staffSessionCache, 'hasDevice', async () => false);
    assert.strictEqual(await getAdminSessionFromRequest(comCookie(ADMIN_AUTH_COOKIE_NAME, token)), null);
  });
});
