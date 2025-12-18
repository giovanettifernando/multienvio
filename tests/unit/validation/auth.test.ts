import assert from 'node:assert';
import test from 'node:test';
import { LoginSchema, RegisterSchema } from '@/shared/validation/auth';

test.describe('validation/auth', () => {
  test('LoginSchema aceita payload válido e rejeita inválido', () => {
    const ok = LoginSchema.parse({ email: 'a@b.com', password: '123456' });
    assert.strictEqual(ok.email, 'a@b.com');

    assert.throws(() => LoginSchema.parse({ email: 'invalid', password: 'x' }), /email/);
  });

  test('RegisterSchema requer campos e valida formato', () => {
    const data = {
      nome: 'Teste',
      email: 'a@b.com',
      senha: 'Abc12345',
      confirmaSenha: 'Abc12345',
      telefone: '(11) 99999-9999',
      aceiteTermos: true,
    };
    const ok = RegisterSchema.parse({ ...data, name: 'Teste', password: 'Abc12345', confirmarSenha: 'Abc12345', acceptTerms: true });
    assert.strictEqual(ok.email, 'a@b.com');

    assert.throws(() => RegisterSchema.parse({ ...data, confirmarSenha: 'diff' }), /iguais|coincidem/i);
    assert.throws(() => RegisterSchema.parse({ ...data, aceiteTermos: false }), /termos|privacy|aceitar/i);
  });
});
