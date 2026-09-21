import assert from 'node:assert';
import test from 'node:test';
import {
  formatBRL,
  formatCentsAsBRL,
  formatNumberBR,
  formatPaymentMethod,
  formatWalletDescription,
  inputNumberFormatterBRL,
  inputNumberParserBRL,
  parsePaginationParams,
} from '@/shared/utils/format';

const NBSP = ' ';

test.describe('utils/format (low-level)', () => {
  test('formatBRL e formatCentsAsBRL formatam em reais', () => {
    assert.strictEqual(formatBRL(1234.5), `R$${NBSP}1.234,50`);
    assert.strictEqual(formatCentsAsBRL(1234), `R$${NBSP}12,34`);
    assert.strictEqual(formatNumberBR(3.14159, 3), '3,142');
  });

  test('campo de valor: formata e lê de volta no padrão brasileiro', () => {
    assert.strictEqual(inputNumberFormatterBRL(1234567.89), '1.234.567,89');
    assert.strictEqual(inputNumberFormatterBRL(''), '');
    assert.strictEqual(inputNumberParserBRL('1.234.567,89'), 1234567.89);
    assert.strictEqual(inputNumberParserBRL('abc'), 0);
    assert.strictEqual(inputNumberParserBRL(undefined), 0);
  });

  test('forma de pagamento e descrição da carteira ficam legíveis', () => {
    assert.strictEqual(formatPaymentMethod('PIX'), 'PIX');
    assert.strictEqual(formatPaymentMethod('wallet'), 'Carteira');
    assert.strictEqual(formatPaymentMethod(null), 'Não informado');
    assert.strictEqual(formatPaymentMethod('outro'), 'outro');
    assert.strictEqual(formatWalletDescription('cart_payment:abc'), 'Pagamento de multiplos envios pelo carrinho');
    assert.strictEqual(formatWalletDescription(null), '');
  });

  test('paginação respeita limites e aceita limit como sinônimo de pageSize', () => {
    assert.deepStrictEqual(parsePaginationParams(new URLSearchParams('page=3&pageSize=20')), {
      page: 3,
      pageSize: 20,
      skip: 40,
      take: 20,
    });
    assert.strictEqual(parsePaginationParams(new URLSearchParams('limit=500')).pageSize, 100);
    assert.strictEqual(parsePaginationParams(new URLSearchParams('page=-2')).page, 1);
    assert.strictEqual(parsePaginationParams(new URLSearchParams(''), { pageSize: 25 }).pageSize, 25);
  });

  test('paginação com lixo na URL cai no padrão em vez de virar NaN no banco', () => {
    const p = parsePaginationParams(new URLSearchParams('page=abc&pageSize=xyz'), { page: 1, pageSize: 10 });
    assert.deepStrictEqual(p, { page: 1, pageSize: 10, skip: 0, take: 10 });
  });
});
