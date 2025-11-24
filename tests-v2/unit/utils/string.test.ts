import assert from 'node:assert';
import test from 'node:test';
import { normalizeString, matchesSearch, debounce } from '../../../lib/utils/string.ts';

test.describe('utils/string', () => {
  test('normalizeString remove acentos e lower-case', () => {
    assert.strictEqual(normalizeString('Árvore'), 'arvore');
  });

  test('matchesSearch trata query vazia como true e compara normalizado', () => {
    assert.strictEqual(matchesSearch('Olá Mundo', ''), true);
    assert.strictEqual(matchesSearch('Árvore', 'arvore'), true);
    assert.strictEqual(matchesSearch('Texto', 'abc'), false);
  });

  test('debounce executa apenas última chamada após delay', async () => {
    const calls: number[] = [];
    const debounced = debounce((v: number) => calls.push(v), 20);
    debounced(1);
    debounced(2);
    debounced(3);
    await new Promise((r) => setTimeout(r, 30));
    assert.deepStrictEqual(calls, [3]);
  });
});
