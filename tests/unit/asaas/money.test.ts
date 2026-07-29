import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, toReais } from '@/platform/integrations/asaas/money';

describe('money', () => {
  it('converte centavos para reais com duas casas', () => {
    assert.equal(toReais(4990), 49.9);
    assert.equal(toReais(8990), 89.9);
    assert.equal(toReais(100), 1);
    assert.equal(toReais(1), 0.01);
    assert.equal(toReais(0), 0);
  });

  it('converte reais para centavos sem erro de ponto flutuante', () => {
    // 49.90 * 100 === 4990.000000000001 em ponto flutuante
    assert.equal(toCents(49.9), 4990);
    assert.equal(toCents(89.9), 8990);
    assert.equal(toCents(0.07), 7);
    assert.equal(toCents(1.005), 101);
    assert.equal(toCents(146.43), 14643);
  });

  it('faz round-trip sem perder valor', () => {
    for (const cents of [1, 7, 99, 4990, 14990, 999999]) {
      assert.equal(toCents(toReais(cents)), cents);
    }
  });

  it('rejeita valores não finitos', () => {
    assert.throws(() => toCents(Number.NaN), /valor monetário inválido/i);
    assert.throws(() => toReais(Number.POSITIVE_INFINITY), /valor monetário inválido/i);
  });

  it('rejeita centavos fracionados', () => {
    assert.throws(() => toReais(10.5), /centavos deve ser inteiro/i);
  });
});
