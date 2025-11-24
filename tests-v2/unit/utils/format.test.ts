import assert from 'node:assert';
import test from 'node:test';
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatSignedCurrency,
  formatWalletDescription,
} from '../../../lib/format.ts';

test.describe('utils/format', () => {
  test('formatCurrencyBRL formata moedas em pt-BR', () => {
    assert.strictEqual(formatCurrencyBRL(0), 'R$\u00a00,00');
    assert.strictEqual(formatCurrencyBRL(1234.56), 'R$\u00a01.234,56');
  });

  test('formatNumberBR respeita casas decimais', () => {
    assert.strictEqual(formatNumberBR(1000.5), '1.000,50');
    assert.strictEqual(formatNumberBR(1000, 0), '1.000');
  });

  test('formatSignedCurrency adiciona sinal correto', () => {
    assert.strictEqual(formatSignedCurrency(50, true), '+ R$\u00a050,00');
    assert.strictEqual(formatSignedCurrency(50, false), '- R$\u00a050,00');
  });

  test('formatWalletDescription trata descrições especiais', () => {
    assert.strictEqual(formatWalletDescription(null), '');
    assert.strictEqual(formatWalletDescription('cart_payment_123'), 'Pagamento de multiplos envios pelo carrinho');
    assert.strictEqual(formatWalletDescription('depósito'), 'depósito');
  });
});
