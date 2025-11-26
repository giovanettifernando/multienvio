import assert from 'node:assert';
import test from 'node:test';
import { getAppStartedAtIso } from '../../../lib/api/runtime.ts';

test.describe('api/runtime', () => {
  test('mantém instante de inicialização estável', () => {
    const iso1 = getAppStartedAtIso();
    const iso2 = getAppStartedAtIso();
    // chamadas subsequentes devem retornar o mesmo valor
    assert.strictEqual(iso1, iso2);
    // deve ser uma ISO válida
    assert.ok(!isNaN(new Date(iso1).getTime()));
  });
});
