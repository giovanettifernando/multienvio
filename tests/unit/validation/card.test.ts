import assert from 'node:assert';
import test from 'node:test';
let CardValidationError: any;
let validateCardCreateInput: any;
let validateCardUpdateInput: any;

test.describe('validation/card', () => {
  test.before(async () => {
    const mod = require('../../../lib/validation/card.ts');
    CardValidationError = mod.CardValidationError;
    validateCardCreateInput = mod.validateCardCreateInput;
    validateCardUpdateInput = mod.validateCardUpdateInput;
  });

  const basePayload = {
    number: '4111111111111111',
    holderName: 'User Name',
    expMonth: '12',
    expYear: `${new Date().getUTCFullYear() + 1}`,
    cvv: '123',
  };

  test('rejeita número ou CVV inválidos', () => {
    assert.throws(() => validateCardCreateInput({ ...basePayload, number: '123' }), CardValidationError);
    assert.throws(() => validateCardCreateInput({ ...basePayload, cvv: '12' }), CardValidationError);
  });

  test('update exige nome válido e expiração correta', () => {
    const updated = validateCardUpdateInput({
      holderName: '  Nome  Teste ',
      expMonth: '11',
      expYear: `${new Date().getUTCFullYear() + 1}`,
      isDefault: true,
    });
    assert.strictEqual(updated.holderName, 'NOME TESTE');
    assert.strictEqual(updated.isDefault, true);
  });

  test('update rejeita se holder inválido', () => {
    assert.throws(() => validateCardUpdateInput({ holderName: '1' }), CardValidationError);
  });
});
