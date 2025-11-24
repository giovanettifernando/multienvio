import assert from 'node:assert';
import test from 'node:test';
import { ProfileSchema } from '../../../lib/validation/profile.ts';

test.describe('validation/profile', () => {
  test('aceita perfil básico e empresa opcional', () => {
    const parsed = ProfileSchema.parse({
      fullName: 'User',
      email: 'a@b.com',
      phone: '123',
      cpf: '00000000000',
      hasCompany: true,
      company: { cnpj: '12345678000100', razaoSocial: 'Empresa' },
    });
    assert.strictEqual(parsed.company?.cnpj, '12345678000100');
  });

  test('rejeita quando hasCompany sem company', () => {
    assert.throws(() => ProfileSchema.parse({
      fullName: 'User',
      email: 'a@b.com',
      phone: '123',
      cpf: '00000000000',
      hasCompany: true,
      company: null,
    }));
  });
});
