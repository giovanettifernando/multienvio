import assert from 'node:assert';
import test from 'node:test';
import {
  normalizeCardNumber,
  isValidCardNumberLength,
  luhnCheck,
  detectCardBrand,
  normalizeHolderName,
  isValidHolderName,
  isCardExpired,
  assertExpirationWindow,
  validateCvvFormat,
} from '../../../lib/utils/card.ts';
import { CardBrand } from '@prisma/client';

test.describe('utils/card', () => {
  test('normalizeCardNumber remove não dígitos e valida comprimento', () => {
    assert.strictEqual(normalizeCardNumber('4111 1111-1111 1111'), '4111111111111111');
    assert.strictEqual(isValidCardNumberLength('123'), false);
    assert.strictEqual(isValidCardNumberLength('4111111111111111'), true);
  });

  test('luhnCheck aceita números válidos e rejeita inválidos', () => {
    assert.strictEqual(luhnCheck('4111111111111111'), true);
    assert.strictEqual(luhnCheck('1234567890123456'), false);
    assert.strictEqual(luhnCheck('abcd'), false);
  });

  test('detectCardBrand identifica principais bandeiras e fallback', () => {
    assert.strictEqual(detectCardBrand('4111111111111111'), CardBrand.VISA);
    assert.strictEqual(detectCardBrand('5500000000000004'), CardBrand.MASTERCARD);
    assert.strictEqual(detectCardBrand('340000000000009'), CardBrand.AMEX);
    assert.strictEqual(detectCardBrand('5066990000000000'), CardBrand.ELO);
    assert.strictEqual(detectCardBrand('6062820000000000'), CardBrand.HIPERCARD);
    assert.strictEqual(detectCardBrand('9999999999999999'), CardBrand.OTHER);
  });

  test('normalizeHolderName e isValidHolderName', () => {
    assert.strictEqual(normalizeHolderName('joão  silva'), 'JOÃO SILVA');
    assert.strictEqual(isValidHolderName('A'), false);
    assert.strictEqual(isValidHolderName('João Silva'), true);
    assert.strictEqual(isValidHolderName('Nome Com Um Tamanho Muito Grande '.repeat(5)), false);
  });

  test('isCardExpired e assertExpirationWindow', () => {
    const ref = new Date('2024-01-15T00:00:00Z');
    assert.strictEqual(isCardExpired(1, 2023, ref), true);
    assert.strictEqual(isCardExpired(12, 2024, ref), false);
    assert.strictEqual(isCardExpired(0, 2024, ref), true);

    // assertExpirationWindow limita mês 1-12 e ano dentro da janela
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    assert.strictEqual(assertExpirationWindow(currentYear + 16, 1), false);
    assert.strictEqual(assertExpirationWindow(currentYear - 2, currentMonth), false);
    assert.strictEqual(assertExpirationWindow(currentYear, 0), false);
    assert.strictEqual(assertExpirationWindow(currentYear, currentMonth), true);
  });

  test('validateCvvFormat aceita 3-4 dígitos', () => {
    assert.strictEqual(validateCvvFormat('123'), true);
    assert.strictEqual(validateCvvFormat('1234'), true);
    assert.strictEqual(validateCvvFormat('12a'), false);
    assert.strictEqual(validateCvvFormat('12'), false);
  });
});
