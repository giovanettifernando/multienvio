import assert from 'node:assert';
import { describe, it, afterEach, mock } from 'node:test';
import { GET as getCart } from '@/app/api/cart/route';
import { POST as checkoutCart } from '@/app/api/cart/checkout/route';
import * as sessionModule from '@/modules/auth/application/session';
import * as cartService from '@/modules/cart/application/cart.service';
import * as cartCheckout from '@/modules/cart/application/cart-checkout.service';
import { apiRequest, callRoute, readApi } from '../../_setup/test-helpers';

afterEach(() => mock.restoreAll());

describe('cart API', () => {
  it('GET exige sessão', async () => {
    mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await callRoute(getCart, apiRequest('/api/cart')));
    assert.strictEqual(res.status, 401);
  });

  it('GET devolve o carrinho aberto do próprio usuário', async () => {
    mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'user-1' }));
    const carrinho = mock.method(cartService, 'getOrCreateOpenCart', async () => ({ id: 'cart-1', status: 'OPEN', items: [] }));

    const res = await readApi(await callRoute(getCart, apiRequest('/api/cart')));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(carrinho.mock.calls[0].arguments[0], 'user-1');
    assert.strictEqual(res.data.cart.id, 'cart-1');
  });

  it('checkout exige sessão', async () => {
    mock.method(sessionModule, 'getSession', async () => null);
    const res = await readApi(await callRoute(checkoutCart, apiRequest('/api/cart/checkout', { json: {} })));
    assert.strictEqual(res.status, 401);
  });

  it('checkout recusa corpo inválido sem processar nada', async () => {
    mock.method(sessionModule, 'getSession', async () => ({ userId: 'user-1' }));
    const processa = mock.method(cartCheckout, 'processCartCheckout', async () => ({}));
    const res = await readApi(await callRoute(checkoutCart, apiRequest('/api/cart/checkout', { json: { itemIds: 'x' } })));
    assert.strictEqual(res.status, 400);
    assert.strictEqual(processa.mock.callCount(), 0);
  });
});
