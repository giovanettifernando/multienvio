import assert from 'node:assert';
import test from 'node:test';
import { AddressSchema } from '../../../lib/validation/address.ts';

test.describe('validation/address', () => {
  test('valida endereço completo', () => {
    const data = {
      cep: '12345678',
      street: 'Rua',
      number: '10',
      district: 'Centro',
      city: 'Cidade',
      state: 'SP',
    };
    const parsed = AddressSchema.parse(data);
    assert.strictEqual(parsed.city, 'Cidade');
  });

  test('rejeita CEP inválido', () => {
    assert.throws(() => AddressSchema.parse({
      cep: '123',
      street: 'Rua',
      number: '10',
      district: 'Centro',
      city: 'Cidade',
      state: 'SP',
    }));
  });
});
