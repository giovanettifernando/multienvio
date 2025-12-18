import assert from 'node:assert';
import test from 'node:test';
import {
  onlyDigits,
  maskPhone,
  maskCNPJ,
  maskCPF,
  maskCEP,
  normalizePhoneInput,
  normalizeCNPJInput,
  normalizeCPFInput,
  formatCPF,
  formatCNPJ,
  formatPhoneBR,
  formatCEP,
  normalizeCEPInput,
} from '@/shared/utils/masks';

test.describe('utils/masks', () => {
  test('onlyDigits remove caracteres não numéricos', () => {
    assert.strictEqual(onlyDigits('a1b2c3'), '123');
  });

  test('maskPhone formata diversos comprimentos', () => {
    assert.strictEqual(maskPhone(''), '');
    assert.strictEqual(maskPhone('1'), '(1');
    assert.strictEqual(maskPhone('1199'), '(11) 99');
    assert.strictEqual(maskPhone('1198765432'), '(11) 9876-5432');
    assert.strictEqual(maskPhone('11987654321'), '(11) 98765-4321');
  });

  test('maskCNPJ e maskCPF respeitam tamanho e formatação', () => {
    assert.strictEqual(maskCNPJ('12345678000199'), '12.345.678/0001-99');
    assert.strictEqual(maskCNPJ(''), '');
    assert.strictEqual(maskCPF('12345678909'), '123.456.789-09');
    assert.strictEqual(maskCPF(''), '');
  });

  test('maskCEP formata CEPs curtos e completos', () => {
    assert.strictEqual(maskCEP('123'), '123');
    assert.strictEqual(maskCEP('12345678'), '12345-678');
  });

  test('normalizers/formatters são aliases dos masks', () => {
    assert.strictEqual(normalizePhoneInput('11987654321'), maskPhone('11987654321'));
    assert.strictEqual(normalizeCNPJInput('12345678000199'), maskCNPJ('12345678000199'));
    assert.strictEqual(normalizeCPFInput('12345678909'), maskCPF('12345678909'));
    assert.strictEqual(normalizeCEPInput('12345678'), maskCEP('12345678'));
    assert.strictEqual(formatCPF('12345678909'), '123.456.789-09');
    assert.strictEqual(formatCNPJ('12345678000199'), '12.345.678/0001-99');
    assert.strictEqual(formatPhoneBR('11987654321'), '(11) 98765-4321');
    assert.strictEqual(formatCEP('12345678'), '12345-678');
  });
});
