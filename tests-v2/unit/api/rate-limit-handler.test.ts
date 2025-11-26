import assert from 'node:assert';
import test from 'node:test';
import { ApiError } from '../../../lib/api/errors.ts';
import { enforceRateLimit } from '../../../lib/api/rate-limit.ts';

test.describe('api/rate-limit', () => {
  test('permite requisições dentro do limite e lança ApiError ao exceder', () => {
    // Usar chave única para evitar conflito entre testes
    const key = `test-${Date.now()}`;
    const input = { key, limit: 2, windowMs: 1000, now: 1000 };
    assert.doesNotThrow(() => enforceRateLimit(input));
    assert.doesNotThrow(() => enforceRateLimit({ ...input, now: 1500 }));
    assert.throws(
      () => enforceRateLimit({ ...input, now: 1800 }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === 'rate_limit_exceeded' &&
        error.status === 429,
    );
  });

  test('timestamps antigos são removidos da janela', () => {
    // Usar chave única para evitar conflito entre testes
    const key = `test-window-${Date.now()}`;
    const input = { key, limit: 1, windowMs: 1000, now: 1000 };
    enforceRateLimit(input);
    // Após a janela expirar, deve permitir nova requisição
    assert.doesNotThrow(() => enforceRateLimit({ ...input, now: 3000 }));
  });
});
