import assert from 'node:assert';
import test from 'node:test';
import * as redisModule from '@/platform/cache/redis';
import { sessionCache, staffSessionCache } from '@/platform/cache/cache';

/** Redis em memória com o que as sessões por aparelho usam. */
function redisFalso() {
  const dados = new Map<string, string>();
  const ttl = new Map<string, number>();
  return {
    dados,
    ttl,
    async setex(k: string, s: number, v: string) { dados.set(k, v); ttl.set(k, s); return 'OK'; },
    async get(k: string) { return dados.get(k) ?? null; },
    async exists(k: string) { return dados.has(k) ? 1 : 0; },
    async expire(k: string, s: number) { if (!dados.has(k)) return 0; ttl.set(k, s); return 1; },
    async del(...ks: string[]) { let n = 0; for (const k of ks) if (dados.delete(k)) n++; return n; },
    async incr(k: string) { const v = Number(dados.get(k) ?? 0) + 1; dados.set(k, String(v)); return v; },
  };
}

for (const [nome, cache] of [['cliente', sessionCache], ['staff', staffSessionCache]] as const) {
  test.describe(`sessões por aparelho (${nome})`, () => {
    let redis: ReturnType<typeof redisFalso>;

    test.beforeEach(() => {
      redis = redisFalso();
      test.mock.method(redisModule, 'isRedisAvailable', () => true);
      test.mock.method(redisModule, 'getRedisClient', () => redis as any);
    });

    test.afterEach(() => test.mock.restoreAll());

    test('cada login abre um aparelho próprio', async () => {
      const a = await cache.openDevice('u1');
      const b = await cache.openDevice('u1');
      assert.notStrictEqual(a, b);
      assert.strictEqual(await cache.hasDevice('u1', a), true);
      assert.strictEqual(await cache.hasDevice('u1', b), true);
    });

    test('sair em um aparelho não derruba o outro', async () => {
      const notebook = await cache.openDevice('u1');
      const celular = await cache.openDevice('u1');

      await cache.closeDevice('u1', celular);

      assert.strictEqual(await cache.hasDevice('u1', celular), false);
      assert.strictEqual(await cache.hasDevice('u1', notebook), true);
    });

    test('aparelho é do usuário: o sid de um não vale para outro', async () => {
      const sid = await cache.openDevice('u1');
      assert.strictEqual(await cache.hasDevice('u2', sid), false);
    });

    test('renovar estende a validade só de aparelho que ainda existe', async () => {
      const sid = await cache.openDevice('u1');
      assert.strictEqual(await cache.touchDevice('u1', sid), true);
      await cache.closeDevice('u1', sid);
      assert.strictEqual(await cache.touchDevice('u1', sid), false);
    });

    test('touch renova a sessão sem mexer na versão do token', async () => {
      await redis.setex(cache.tokenVersionKeyPrefixed('u1'), 10, '7');
      await cache.touch('u1');
      assert.strictEqual(await cache.getTokenVersion('u1'), 7);
      assert.strictEqual(redis.ttl.get(cache.tokenVersionKeyPrefixed('u1')), 604800);
    });

    test('Redis fora do ar: aparelho não é reconhecido (falha fechada)', async () => {
      const sid = await cache.openDevice('u1');
      test.mock.method(redisModule, 'isRedisAvailable', () => false);
      assert.strictEqual(await cache.hasDevice('u1', sid), false);
    });
  });
}
