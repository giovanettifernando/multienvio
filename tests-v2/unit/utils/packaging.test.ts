import assert from 'node:assert';
import test from 'node:test';
import { formatPackagingName } from '../../../lib/utils/packaging.ts';

test.describe('utils/packaging', () => {
  test('usa nome customizado quando presente', () => {
    const result = formatPackagingName({
      lengthCm: 10,
      widthCm: 5,
      heightCm: 3,
      name: 'Caixa Pequena',
    });
    assert.strictEqual(result, 'Caixa Pequena');
  });

  test('formata dimensões removendo zeros desnecessários', () => {
    const result = formatPackagingName({
      lengthCm: 10,
      widthCm: 5.5,
      heightCm: 3.01,
    });
    assert.strictEqual(result, 'C (10) x L (5.5) x A (3.01)');
  });
});
