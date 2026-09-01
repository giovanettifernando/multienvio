import assert from 'node:assert';
import test from 'node:test';
import { dceKeySchema } from '@/shared/validation/dce';

const CHAVE_VALIDA = '41260912345678000195990010000000421011234561';
const CHAVE_NFE = '41260912345678000195550010000000421011234566';

test.describe('validation/dce — dceKeySchema', () => {
  test('aceita chave válida e devolve só os dígitos', () => {
    const r = dceKeySchema.safeParse(' 4126 0912 3456 7800 0195 9900 1000 0000 4210 1123 4561 ');
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data, CHAVE_VALIDA);
  });

  test('rejeita chave de NF-e com mensagem explicativa', () => {
    const r = dceKeySchema.safeParse(CHAVE_NFE);
    assert.equal(r.success, false);
    if (!r.success) {
      assert.match(r.error.issues[0].message, /DC-e/);
    }
  });

  test('rejeita texto vazio', () => {
    assert.equal(dceKeySchema.safeParse('').success, false);
  });
});
