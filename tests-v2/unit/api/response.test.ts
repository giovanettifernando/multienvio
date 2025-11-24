import assert from 'node:assert';
import test from 'node:test';
import { ApiError } from '../../../lib/api/errors.ts';
import { buildMeta, success, failure } from '../../../lib/api/response.ts';

test.describe('api/response helpers', () => {
  test('buildMeta inclui extras', () => {
    const meta = buildMeta({
      requestId: 'req-1',
      path: '/health',
      method: 'GET',
      durationMs: 12,
      extras: { tag: 'test' },
    });
    assert.strictEqual(meta.requestId, 'req-1');
    assert.strictEqual(meta.path, '/health');
    assert.strictEqual(meta.tag, 'test');
    assert.ok(meta.timestamp);
  });

  test('success e failure montam envelopes', () => {
    const meta = buildMeta({ requestId: 'r', path: '/', method: 'GET', durationMs: 1 });
    const okBody = success({ ok: true }, meta);
    assert.deepStrictEqual(okBody.data, { ok: true });
    assert.strictEqual(okBody.error, null);

    const err = new ApiError({ code: 'X', message: 'fail', status: 500 });
    const failBody = failure(err, meta);
    assert.strictEqual(failBody.data, null);
    assert.strictEqual(failBody.error?.code, 'X');
    assert.strictEqual(failBody.error?.requestId, meta.requestId);
  });
});
