import assert from 'node:assert';
import test from 'node:test';
import { cadastroSchema, loginSchema } from '@/shared/validation/auth';

test.describe('validation/password-policy (auth)', () => {
  test('cadastro aceita senha forte e telefones opcionais', () => {
    const parsed = cadastroSchema.parse({
      nomeCompleto: 'Usuario Teste',
      email: 'user@example.com',
      senha: 'Strong123',
      confirmarSenha: 'Strong123',
      telefone: '(11) 91234-5678',
      consentLGPD: true,
    });
    assert.strictEqual(parsed.senha, 'Strong123');
  });

  test('cadastro rejeita senhas diferentes', () => {
    assert.throws(() => cadastroSchema.parse({
      nomeCompleto: 'Usuario',
      email: 'a@b.com',
      senha: 'Strong123',
      confirmarSenha: 'Weak123',
      consentLGPD: true,
    }));
  });

  test('login requer email e senha', () => {
    const parsed = loginSchema.parse({ email: 'a@b.com', senha: '123' });
    assert.strictEqual(parsed.email, 'a@b.com');
  });
});
