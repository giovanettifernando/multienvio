import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../../../../../../../app/api/payments/mercadopago/public-key/route.ts';
import * as config from '../../../../../../../lib/mercadopago/config.ts';

test.describe('app/api/payments/mercadopago/public-key', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('retorna 503 quando sem chave', async () => {
    test.mock.method(config, 'getMercadoPagoPublicKey', async () => null);
    const res = await GET();
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.error, 'Mercado Pago não configurado');
  });

  test('retorna chave quando presente', async () => {
    test.mock.method(config, 'getMercadoPagoPublicKey', async () => 'pk_test');
    const res = await GET();
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.publicKey, 'pk_test');
  });
});
