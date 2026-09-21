import assert from 'node:assert';
import test from 'node:test';
import { enforceRateLimit } from '@/platform/api/rate-limit';
import { rateLimitByIP } from '@/platform/cache/rate-limit-redis';
import * as redis from '@/platform/cache/redis';
import { apiRequest } from '../_setup/test-helpers';

let seq = 0;
/** Ação única por teste: os contadores locais vivem no módulo. */
const acao = () => `teste_${process.pid}_${++seq}`;

test.describe('rate-limit em memória (enforceRateLimit)', () => {
  test('libera até o limite e responde 429 depois', () => {
    const key = acao();
    enforceRateLimit({ key, limit: 2, windowMs: 60_000, now: 1_000 });
    enforceRateLimit({ key, limit: 2, windowMs: 60_000, now: 1_001 });
    assert.throws(
      () => enforceRateLimit({ key, limit: 2, windowMs: 60_000, now: 1_002 }),
      (e: any) => e.status === 429
    );
  });

  test('a janela desliza: pedidos antigos deixam de contar', () => {
    const key = acao();
    enforceRateLimit({ key, limit: 1, windowMs: 1_000, now: 0 });
    assert.doesNotThrow(() => enforceRateLimit({ key, limit: 1, windowMs: 1_000, now: 5_000 }));
  });
});

test.describe('rate-limit por IP (fallback local, sem Redis)', () => {
  const trustProxy = process.env.TRUST_PROXY;

  test.beforeEach(() => {
    test.mock.method(redis, 'isRedisAvailable', () => false);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    if (trustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = trustProxy;
  });

  const pedido = (headers: Record<string, string>) => apiRequest('/api/qualquer', { headers });

  test('com proxy confiável, conta por IP e bloqueia com 429 + Retry-After', async () => {
    process.env.TRUST_PROXY = 'true';
    const a = acao();
    const config = { windowMs: 60_000, maxRequests: 2 };
    const ip1 = pedido({ 'x-forwarded-for': '1.1.1.1, 10.0.0.1' });

    assert.strictEqual(await rateLimitByIP(ip1, a, config), null);
    assert.strictEqual(await rateLimitByIP(ip1, a, config), null);
    const bloqueado = await rateLimitByIP(ip1, a, config);
    assert.strictEqual(bloqueado?.status, 429);
    assert.ok(Number(bloqueado?.headers.get('retry-after')) > 0);

    // outro IP tem o próprio contador
    assert.strictEqual(await rateLimitByIP(pedido({ 'x-forwarded-for': '2.2.2.2' }), a, config), null);
  });

  test('sem proxy confiável, ignora cabeçalho de IP (anti-spoofing) e usa bucket global com metade do limite', async () => {
    delete process.env.TRUST_PROXY;
    const a = acao();
    const config = { windowMs: 60_000, maxRequests: 4 };

    // trocar o IP no cabeçalho não escapa do limite
    assert.strictEqual(await rateLimitByIP(pedido({ 'x-real-ip': '1.1.1.1' }), a, config), null);
    assert.strictEqual(await rateLimitByIP(pedido({ 'x-real-ip': '2.2.2.2' }), a, config), null);
    const bloqueado = await rateLimitByIP(pedido({ 'x-real-ip': '3.3.3.3' }), a, config);
    assert.strictEqual(bloqueado?.status, 429);
  });
});
