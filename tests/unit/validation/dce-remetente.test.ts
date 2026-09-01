import assert from 'node:assert';
import test from 'node:test';
import { assertSenderCanUseDeclaration } from '@/shared/validation/dce';

test.describe('validation/dce — assertSenderCanUseDeclaration', () => {
  test('passa com CPF preenchido', () => {
    assert.doesNotThrow(() => assertSenderCanUseDeclaration({ cpf: '12345678909', cnpj: null }));
  });

  test('passa com CNPJ preenchido', () => {
    assert.doesNotThrow(() => assertSenderCanUseDeclaration({ cpf: null, cnpj: '12345678000195' }));
  });

  test('falha sem documento, com código próprio', () => {
    assert.throws(
      () => assertSenderCanUseDeclaration({ cpf: null, cnpj: null }),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, 'SENDER_DOCUMENT_REQUIRED');
        assert.match(err.message, /Minha conta/);
        return true;
      }
    );
  });

  test('trata string vazia como ausente', () => {
    assert.throws(() => assertSenderCanUseDeclaration({ cpf: '', cnpj: '' }));
  });
});
