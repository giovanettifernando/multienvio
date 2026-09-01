import assert from 'node:assert';
import test from 'node:test';
import { isValidDceKey, parseDceKey } from '@/shared/validation/dce';

// Chave de DC-e válida (modelo 99), com DV calculado pelo módulo 11.
const CHAVE_VALIDA = '41260912345678000195990010000000421011234561';
// Mesma chave com modelo 55 — é uma NF-e, não uma DC-e.
const CHAVE_NFE = '41260912345678000195550010000000421011234566';
// Mesma chave da DC-e com o último dígito trocado.
const CHAVE_DV_ERRADO = '41260912345678000195990010000000421011234562';

test.describe('validation/dce — isValidDceKey', () => {
  test('aceita chave de DC-e válida', () => {
    assert.equal(isValidDceKey(CHAVE_VALIDA), true);
  });

  test('aceita chave com máscara e espaços', () => {
    assert.equal(isValidDceKey(' 4126 0912 3456 7800 0195 9900 1000 0000 4210 1123 4561 '), true);
  });

  test('rejeita dígito verificador errado', () => {
    assert.equal(isValidDceKey(CHAVE_DV_ERRADO), false);
  });

  test('rejeita chave de NF-e (modelo 55)', () => {
    assert.equal(isValidDceKey(CHAVE_NFE), false);
  });

  test('rejeita comprimento diferente de 44', () => {
    assert.equal(isValidDceKey(CHAVE_VALIDA.slice(0, 43)), false);
    assert.equal(isValidDceKey(CHAVE_VALIDA + '0'), false);
  });

  test('rejeita entrada vazia ou não numérica', () => {
    assert.equal(isValidDceKey(''), false);
    assert.equal(isValidDceKey('abc'), false);
  });
});

test.describe('validation/dce — parseDceKey', () => {
  test('separa os campos da chave', () => {
    const partes = parseDceKey(CHAVE_VALIDA);
    assert.ok(partes);
    assert.equal(partes.cUF, '41');
    assert.equal(partes.anoMes, '2609');
    assert.equal(partes.cnpjEmitente, '12345678000195');
    assert.equal(partes.modelo, '99');
    assert.equal(partes.serie, '001');
    assert.equal(partes.numero, '000000042');
    assert.equal(partes.tpEmis, '1');
    assert.equal(partes.tpEmit, '0');
    assert.equal(partes.siteAutorizador, '1');
    assert.equal(partes.codigoNumerico, '123456');
    assert.equal(partes.dv, '1');
  });

  test('devolve null para chave inválida', () => {
    assert.equal(parseDceKey(CHAVE_DV_ERRADO), null);
  });
});
