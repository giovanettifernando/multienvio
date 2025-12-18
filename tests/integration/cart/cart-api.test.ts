import { describe, it, strictEqual, afterEach } from 'node:test';
import { mock } from 'node:test';
import { GET as getCart } from '@/app/api/carrinho/route';
import { POST as checkoutCart } from '@/app/api/cart/checkout/route';
import { prisma } from '@/platform/db/db';
import * as sessionModule from '@/modules/auth/application/session';

afterEach(() => mock.restoreAll());

describe('cart API', () => {
  it('cria carrinho vazio quando inexistente', async () => {
    mock.method(sessionModule, 'getSession', async () => ({ userId: 'user-1' } as any));
    mock.method(prisma.cart, 'findFirst', async () => null as any);
    const created = {
      id: 'cart-1',
      userId: 'user-1',
      status: 'OPEN',
      totals: { total: 0, moeda: 'BRL' },
      meta: {},
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mock.method(prisma.cart, 'create', async () => created as any);

    const res = await getCart();
    strictEqual(res.status, 200);
    const body = await res.json();
    strictEqual(body.cart.id, 'cart-1');
    strictEqual(body.cart.status, 'OPEN');
  });

  it('retorna 404 quando checkout não encontra carrinho', async () => {
    mock.method(sessionModule, 'getSession', async () => ({ userId: 'user-1' } as any));
    mock.method(prisma, '$transaction', async (cb: any) =>
      cb({
        cart: {
          findFirst: async () => null,
        },
      })
    );

    const req = new Request('http://test/api/cart/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemIds: [], paymentMethod: 'wallet' }),
    });

    const res = await checkoutCart(req);
    strictEqual(res.status, 404);
    const body = await res.json();
    strictEqual(body.message, 'Carrinho não encontrado');
  });
});
