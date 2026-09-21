import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/cart/items/route';
import { ApiError } from '@/platform/api/errors';
import * as sessionModule from '@/modules/auth/application/session';
import * as checkoutService from '@/modules/cart/application/checkout.service';
import * as cartItems from '@/modules/cart/application/cart-items.service';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const endereco = { cep: '01310100', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' };

/** Item como a tela manda, com um preço adulterado de R$ 0,01. */
function itemAdulterado(extra: Record<string, unknown> = {}) {
  return {
    quoteId: 'q1',
    originAddress: endereco,
    destination: { ...endereco, cep: '20040002', cidade: 'Rio de Janeiro', uf: 'RJ' },
    volumes: [{ comprimentoCm: 20, larguraCm: 16, alturaCm: 15, pesoKg: 1 }],
    preferences: {},
    selectedQuote: { carrier: 'Correios', serviceCode: '03220', serviceName: 'SEDEX', price: 0.01, deadlineDays: 1 },
    totals: { subtotal: 0.01, total: 0.01, moeda: 'BRL' },
    ...extra,
  };
}

const adicionar = (json: unknown) => callRoute(POST, apiRequest('/api/cart/items', { json }));

test.describe('app/api/cart/items (POST)', () => {
  test.beforeEach(() => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    test.mock.method(cartItems, 'addItem', async (_u: string, data: any) => ({ id: 'item-1', ...data }));
  });

  test.afterEach(() => test.mock.restoreAll());

  test('exige a cotação de origem do preço', async () => {
    const { quoteId: _sem, ...semCotacao } = itemAdulterado();
    const res = await readApi(await adicionar(semCotacao));
    assert.strictEqual(res.status, 400);
    assert.strictEqual((cartItems.addItem as any).mock.callCount(), 0);
  });

  test('preço, transportadora e serviço vêm da cotação salva, não do navegador', async () => {
    const validar = test.mock.method(checkoutService, 'validateQuoteAndGetPrice', async () => ({
      quoteId: 'q1',
      freightCostCents: 4250,
      freightCost: 42.5,
      estimatedDays: 6,
      carrier: 'Correios',
      service: 'PAC',
      serviceCode: '03298',
    }));

    const res = await readApi(await adicionar(itemAdulterado()));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(validar.mock.calls[0].arguments, ['q1', 'u1', 0.01]);
    const gravado = (cartItems.addItem as any).mock.calls[0].arguments[1];
    assert.deepStrictEqual(gravado.selectedQuote, {
      carrier: 'Correios',
      serviceCode: '03298',
      serviceName: 'PAC',
      price: 42.5,
      deadlineDays: 6,
      source: 'quote',
    });
    assert.strictEqual(gravado.totals.total, 42.5);
    assert.strictEqual(gravado.totals.subtotal, 42.5);
  });

  test('cotação de outro usuário ou vencida não entra no carrinho', async () => {
    test.mock.method(checkoutService, 'validateQuoteAndGetPrice', async () => {
      throw new ApiError({ code: 'QUOTE_EXPIRED', message: 'Esta cotação expirou.', status: 400 });
    });

    const res = await readApi(await adicionar(itemAdulterado()));

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error.code, 'QUOTE_EXPIRED');
    assert.strictEqual((cartItems.addItem as any).mock.callCount(), 0);
  });
});
