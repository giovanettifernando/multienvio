import assert from 'node:assert';
import test from 'node:test';
import { ensureTracking } from '../../../lib/api/tracking.ts';

test.describe('api/tracking', () => {
  test('gera tracking determinístico por shipmentId', () => {
    const t1 = ensureTracking('abc');
    const t2 = ensureTracking('abc');
    assert.deepStrictEqual(t1.status, t2.status);
    assert.strictEqual(t1.shipmentId, 'abc');
    assert.ok(t1.events.length >= 4);
  });
});
