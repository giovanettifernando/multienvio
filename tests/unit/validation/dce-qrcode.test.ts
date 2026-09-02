import assert from 'node:assert';
import test from 'node:test';
import { buildDceQrCodeUrl } from '@/shared/validation/dce';

const CHAVE = '41260912345678000195990010000000421011234561';

test.describe('validation/dce — buildDceQrCodeUrl', () => {
  test('monta a URL de consulta com a chave', () => {
    const url = buildDceQrCodeUrl(CHAVE);
    assert.match(url, /chDCe=41260912345678000195990010000000421011234561/);
    assert.match(url, /tpAmb=1/);
  });

  test('aceita ambiente de homologação', () => {
    assert.match(buildDceQrCodeUrl(CHAVE, 2), /tpAmb=2/);
  });

  test('normaliza chave com máscara', () => {
    const url = buildDceQrCodeUrl(' 4126 0912 3456 7800 0195 9900 1000 0000 4210 1123 4561 ');
    assert.match(url, /chDCe=41260912345678000195990010000000421011234561/);
  });

  test('rejeita chave inválida', () => {
    assert.throws(() => buildDceQrCodeUrl('123'));
  });
});
