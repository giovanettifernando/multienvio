import { describe, it, strictEqual } from 'node:test';
import {
  normalizeCep,
  formatCep,
  calculateCubicWeight,
  validateQuoteBusinessRules,
  calculateQuoteExpiration,
} from '@/lib/validation/quote-backend';

describe('quote validation helpers', () => {
  it('normaliza e formata CEP', () => {
    strictEqual(normalizeCep('12345-678'), '12345678');
    strictEqual(formatCep('12345678'), '12345-678');
  });

  it('calcula peso cúbico corretamente', () => {
    strictEqual(calculateCubicWeight(30, 20, 10), 1.2); // (30*20*10)/6000
  });

  it('verifica regras de validade e cancelamento', () => {
    const expiresSoon = new Date(Date.now() + 1000);
    strictEqual(validateQuoteBusinessRules.isQuoteValid(expiresSoon), true);
    strictEqual(validateQuoteBusinessRules.canSelectQuote('DRAFT', expiresSoon), true);
    strictEqual(validateQuoteBusinessRules.canConfirmQuote('SELECTED', expiresSoon), true);
    strictEqual(validateQuoteBusinessRules.canCancelQuote('CONFIRMED'), false);
  });

  it('gera expiração no futuro', () => {
    const exp = calculateQuoteExpiration();
    strictEqual(exp.getTime() > Date.now(), true);
  });
});
