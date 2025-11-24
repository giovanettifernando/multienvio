import assert from 'node:assert';
import test from 'node:test';
import { getAppStartedAt, getAppStartedAtIso } from '../../../lib/api/runtime.ts';

test.describe('api/runtime', () => {
  test('mantém instante de inicialização estável', () => {
    const first = getAppStartedAt();
    const iso = getAppStartedAtIso();
    assert.strictEqual(new Date(iso).getTime(), first);
    // chamada subsequente deve ser igual
    assert.strictEqual(getAppStartedAt(), first);
  });
});
