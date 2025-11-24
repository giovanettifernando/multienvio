import assert from 'node:assert';
import test from 'node:test';
import { ApiError } from '../../../lib/api/errors.ts';
import { enforceRateLimit, resetRateLimit } from '../../../lib/api/rate-limit.ts';

test.describe('api/rate-limit', () => {
  test.afterEach(() => {
    resetRateLimit('key');
  });

  test('permite requisições dentro do limite e lança ApiError ao exceder', () => {
    const input = { key: 'key', limit: 2, windowMs: 1000, now: 1000 };
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

  test('resetRateLimit limpa contador', () => {
    const input = { key: 'key', limit: 1, windowMs: 1000, now: 1000 };
    enforceRateLimit(input);
    assert.throws(() => enforceRateLimit({ ...input, now: 1001 }));
    resetRateLimit('key');
    assert.doesNotThrow(() => enforceRateLimit({ ...input, now: 2000 }));
  });
});
