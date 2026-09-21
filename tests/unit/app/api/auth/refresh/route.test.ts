import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/auth/refresh/route';
import { sessionCache } from '@/platform/cache/cache';
import * as rateLimit from '@/platform/cache/rate-limit-redis';
import { signTokenPair, verifyToken } from '@/modules/auth/application/jwt-tokens';
import { apiRequest } from '../../../../../_setup/test-helpers';

const sessao = { userId: 'u1', email: 'a@b.com', role: 'user', status: 'active', tokenVersion: 3 };

async function renovar(tokenPayload: Record<string, unknown>) {
  const { refreshToken } = await signTokenPair({ userId: 'u1', email: 'a@b.com', role: 'user', tokenVersion: 3, ...tokenPayload } as any);
  return POST(apiRequest('/api/auth/refresh', { method: 'POST', headers: { cookie: `refresh_token=${refreshToken}` } }));
}

function cookie(res: Response, nome: string) {
  const c = res.headers.getSetCookie().find((v) => v.startsWith(`${nome}=`));
  return c ? decodeURIComponent(c.split(';')[0].slice(nome.length + 1)) : undefined;
}

test.describe('app/api/auth/refresh', () => {
  test.beforeEach(() => {
    test.mock.method(rateLimit, 'rateLimitByIP', async () => null);
    test.mock.method(sessionCache, 'getTokenVersion', async () => 3);
    test.mock.method(sessionCache, 'get', async () => sessao);
    test.mock.method(sessionCache, 'hasDevice', async () => true);
    test.mock.method(sessionCache, 'touchDevice', async () => true);
    test.mock.method(sessionCache, 'touch', async () => true);
    test.mock.method(sessionCache, 'openDevice', async () => 's-novo');
    test.mock.method(sessionCache, 'incrementTokenVersion', async () => 4);
  });

  test.afterEach(() => test.mock.restoreAll());

  test('renova sem mexer na versão: os outros aparelhos seguem logados', async () => {
    const res = await renovar({ sid: 's-note' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual((sessionCache.incrementTokenVersion as any).mock.callCount(), 0);
    assert.deepStrictEqual((sessionCache.touchDevice as any).mock.calls[0].arguments, ['u1', 's-note']);
    assert.strictEqual((sessionCache.touch as any).mock.callCount(), 1);

    const { payload } = await verifyToken(cookie(res, 'auth_token')!, 'access');
    assert.strictEqual(payload?.tokenVersion, 3);
    assert.strictEqual(payload?.sid, 's-note');
    const refresh = await verifyToken(cookie(res, 'refresh_token')!, 'refresh');
    assert.strictEqual(refresh.payload?.sid, 's-note');
  });

  test('aparelho que saiu não renova e tem os cookies apagados', async () => {
    test.mock.method(sessionCache, 'touchDevice', async () => false);
    test.mock.method(sessionCache, 'hasDevice', async () => false);

    const res = await renovar({ sid: 's-note' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(cookie(res, 'auth_token'), '');
  });

  test('conta bloqueada (versão nova) não renova', async () => {
    test.mock.method(sessionCache, 'getTokenVersion', async () => 4);
    const res = await renovar({ sid: 's-note' });
    assert.strictEqual(res.status, 401);
  });

  test('token de antes da mudança (sem aparelho) ganha um aparelho ao renovar', async () => {
    const res = await renovar({});

    assert.strictEqual(res.status, 200);
    assert.strictEqual((sessionCache.openDevice as any).mock.calls[0].arguments[0], 'u1');
    const { payload } = await verifyToken(cookie(res, 'auth_token')!, 'access');
    assert.strictEqual(payload?.sid, 's-novo');
  });
});
