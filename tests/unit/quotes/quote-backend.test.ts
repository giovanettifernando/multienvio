import { describe, it } from 'node:test';
import {
  normalizeCep,
  formatCep,
  calculateCubicWeight,
  validateQuoteBusinessRules,
  calculateQuoteExpiration,
} from '@/shared/validation/quote-backend';
import assert from 'node:assert/strict';

describe('quote validation helpers', () => {
  it('normaliza e formata CEP', () => {
    assert.strictEqual(normalizeCep('12345-678'), '12345678');
    assert.strictEqual(formatCep('12345678'), '12345-678');
  });

  it('calcula peso cúbico com divisor 6000 e 2 casas decimais', () => {
    assert.strictEqual(calculateCubicWeight(30, 20, 10), 1); // (30*20*10)/6000 arredondado para 2 casas
  });

  it('verifica regras de validade e cancelamento', () => {
    const expiresSoon = new Date(Date.now() + 1000);
    assert.strictEqual(validateQuoteBusinessRules.isQuoteValid(expiresSoon), true);
    assert.strictEqual(validateQuoteBusinessRules.canSelectQuote('DRAFT', expiresSoon), true);
    assert.strictEqual(validateQuoteBusinessRules.canConfirmQuote('SELECTED', expiresSoon), true);
    assert.strictEqual(validateQuoteBusinessRules.canCancelQuote('CONFIRMED'), false);
  });

  it('gera expiração no futuro', () => {
    const exp = calculateQuoteExpiration();
    assert.strictEqual(exp.getTime() > Date.now(), true);
  });
});
