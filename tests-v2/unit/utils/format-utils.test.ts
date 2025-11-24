import assert from 'node:assert';
import test from 'node:test';
import { formatBRL, parseBRL } from '../../../lib/utils/format.ts';

test.describe('utils/format (low-level)', () => {
  test('formatBRL trata nulos e formata valores', () => {
    assert.strictEqual(formatBRL(null), '—');
    assert.strictEqual(formatBRL(undefined), '—');
    assert.strictEqual(formatBRL(12.5), 'R$\u00a012,50');
  });

  test('parseBRL remove formatação ou retorna undefined', () => {
    assert.strictEqual(parseBRL('R$ 1.234,56'), 1234.56);
    assert.strictEqual(parseBRL(''), undefined);
    assert.strictEqual(parseBRL('abc'), undefined);
  });
});
