import assert from 'node:assert';
import test from 'node:test';
import { shippingServices } from '@/shared/utils/services';

test.describe('services/shippingServices', () => {
  test('lista contém serviços conhecidos com atributos essenciais', () => {
    assert.ok(shippingServices.length >= 5);
    const sedex = shippingServices.find((s) => s.code === 'CORREIOS_SEDEX');
    assert.ok(sedex);
    assert.strictEqual(typeof sedex?.price, 'number');
    assert.strictEqual(sedex?.carrier, 'Correios');
  });
});
