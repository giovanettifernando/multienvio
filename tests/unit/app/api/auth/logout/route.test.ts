import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/auth/logout/route';
import { sessionCache, userCache } from '@/platform/cache/cache';
import { apiRequest, callRoute } from '../../../../../_setup/test-helpers';

function logout(headers: Record<string, string> = {}) {
  return callRoute(POST as any, apiRequest('/api/auth/logout', { method: 'POST', headers }));
}

test.describe('app/api/auth/logout', () => {
  let sessionModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../modules/auth/application/session.ts');
  });

  test.beforeEach(() => {
    test.mock.method(sessionCache, 'incrementTokenVersion', async () => 2);
    test.mock.method(sessionCache, 'closeDevice', async () => true);
    test.mock.method(userCache, 'invalidate', async () => true);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('bloqueia logout disparado por outro site (CSRF)', async () => {
    const destruiu = test.mock.method(sessionModule, 'destroySession', async () => {});
    const res = await logout({ origin: 'https://site-malicioso.com', host: 'test' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(destruiu.mock.callCount(), 0);
  });

  test('encerra só este aparelho: os outros seguem logados', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1', sid: 's-celular' }));
    const destruiu = test.mock.method(sessionModule, 'destroySession', async () => {});

    const res = await logout();

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual((sessionCache.closeDevice as any).mock.calls[0].arguments, ['u1', 's-celular']);
    assert.strictEqual((sessionCache.incrementTokenVersion as any).mock.callCount(), 0, 'não pode derrubar os outros aparelhos');
    assert.strictEqual(destruiu.mock.callCount(), 1);
  });

  test('token de antes da sessão por aparelho: revoga tudo, como antes', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    const destruiu = test.mock.method(sessionModule, 'destroySession', async () => {});

    const res = await logout();

    assert.strictEqual(res.status, 200);
    const incremento = (sessionCache.incrementTokenVersion as any).mock.calls;
    assert.strictEqual(incremento.length, 1, 'tokens antigos precisam ficar inválidos');
    assert.strictEqual(incremento[0].arguments[0], 'u1');
    assert.strictEqual((userCache.invalidate as any).mock.calls[0].arguments[0], 'u1');
    assert.strictEqual(destruiu.mock.callCount(), 1);
  });

  test('responde 500 com mensagem amigável em erro inesperado', async () => {
    test.mock.method(sessionModule, 'getSession', async () => {
      throw new Error('boom');
    });
    const res = await logout();
    assert.strictEqual(res.status, 500);
    assert.strictEqual((await res.json()).message, 'Erro ao realizar logout');
  });
});
