import assert from 'node:assert';
import test from 'node:test';
import { UpdateProfileSchema } from '../../../lib/validation/profile.ts';

test.describe('validation/profile', () => {
  test('aceita perfil básico e normaliza campos', () => {
    const parsed = UpdateProfileSchema.parse({
      name: '  User  Name ',
      phone: '(11) 91234-5678',
      cpf: '39053344705', // CPF válido
      hasCompany: true,
      cnpj: '27865757000102', // CNPJ válido
      razaoSocial: '  Empresa   Teste ',
    });
    assert.strictEqual(parsed.name, 'User Name');
    assert.strictEqual(parsed.phone, '11912345678');
    assert.strictEqual(parsed.cnpj, '27865757000102');
    assert.strictEqual(parsed.razaoSocial, 'Empresa Teste');
  });

  test('permite hasCompany com campos vazios normalizados para null', () => {
    const parsed = UpdateProfileSchema.parse({
      name: 'User Name',
      hasCompany: true,
      cnpj: null,
      razaoSocial: '',
    });
    assert.strictEqual(parsed.hasCompany, true);
    assert.strictEqual(parsed.cnpj, null);
    assert.strictEqual(parsed.razaoSocial, null);
  });
});
