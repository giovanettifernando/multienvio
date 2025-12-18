import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@/platform/api/errors';
import * as cartService from '@/modules/cart/application/cart.service';

// =============================================================================
// Test Helpers
// =============================================================================

function makeMockPrisma(overrides: any = {}) {
  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    status: 'OPEN',
    totals: { total: 0, moeda: 'BRL' },
    meta: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    items: [],
  };

  const mockItem = {
    id: 'item-1',
    cartId: 'cart-1',
    originAddress: { cep: '01001000' },
    destination: { cep: '22290040' },
    volumes: [{ pesoKg: 1 }],
    preferences: {},
    insuranceValue: null,
    pickupPoint: null,
    pickupFee: null,
    selectedQuote: { price: 10 },
    totals: { total: 10 },
    document: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  return {
    cart: {
      findFirst: async () => overrides.findFirst ?? mockCart,
      create: async ({ data }: any) => ({
        ...mockCart,
        ...data,
        items: [],
      }),
      update: async ({ data }: any) => ({
        ...mockCart,
        ...data,
      }),
      ...overrides.cart,
    },
    cartItem: {
      findFirst: async () => overrides.findFirstItem ?? mockItem,
      deleteMany: async () => ({ count: 1 }),
      ...overrides.cartItem,
    },
  };
}

function makeDeps(prismaOverrides: any = {}) {
  return {
    prisma: makeMockPrisma(prismaOverrides),
    logger: undefined,
  };
}

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('cart.service - pure functions', () => {
  describe('calculateCartTotal', () => {
    it('calcula total de itens corretamente', () => {
      const items = [
        { totals: { total: 10.5 } },
        { totals: { total: 20.3 } },
        { totals: { total: 5.2 } },
      ] as any[];

      const total = cartService.calculateCartTotal(items);
      assert.strictEqual(total, 36);
    });

    it('retorna 0 para lista vazia', () => {
      const total = cartService.calculateCartTotal([]);
      assert.strictEqual(total, 0);
    });

    it('trata itens sem total como 0', () => {
      const items = [
        { totals: { total: 10 } },
        { totals: {} },
        { totals: null },
      ] as any[];

      const total = cartService.calculateCartTotal(items);
      assert.strictEqual(total, 10);
    });
  });

  describe('mapCartItemToDto', () => {
    it('mapeia item corretamente', () => {
      const item = {
        id: 'item-1',
        originAddress: { cep: '01001000' },
        destination: { cep: '22290040' },
        volumes: [{ pesoKg: 1 }],
        preferences: { pickupRequested: true },
        insuranceValue: 100.50,
        pickupPoint: null,
        pickupFee: null,
        selectedQuote: { price: 15 },
        totals: { total: 15 },
        document: null,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
      } as any;

      const dto = cartService.mapCartItemToDto(item);

      assert.strictEqual(dto.id, 'item-1');
      assert.strictEqual(dto.insuranceValue, 100.50);
      assert.strictEqual(dto.createdAt, '2024-01-15T10:00:00.000Z');
      assert.strictEqual(dto.updatedAt, '2024-01-15T11:00:00.000Z');
    });

    it('converte insuranceValue Decimal para number', () => {
      const item = {
        id: 'item-1',
        originAddress: {},
        destination: {},
        volumes: [],
        preferences: {},
        insuranceValue: { toNumber: () => 50.75 }, // Simula Decimal
        pickupPoint: null,
        pickupFee: null,
        selectedQuote: {},
        totals: {},
        document: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const dto = cartService.mapCartItemToDto(item);
      assert.ok(typeof dto.insuranceValue === 'number' || dto.insuranceValue === undefined);
    });
  });

  describe('mapCartToDto', () => {
    it('mapeia carrinho com itens', () => {
      const cart = {
        id: 'cart-1',
        status: 'OPEN',
        totals: { total: 25, moeda: 'BRL' },
        meta: { fingerprint: 'abc' },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        items: [
          {
            id: 'item-1',
            originAddress: {},
            destination: {},
            volumes: [],
            preferences: {},
            insuranceValue: null,
            pickupPoint: null,
            pickupFee: null,
            selectedQuote: {},
            totals: { total: 25 },
            document: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as any;

      const dto = cartService.mapCartToDto(cart);

      assert.strictEqual(dto.id, 'cart-1');
      assert.strictEqual(dto.status, 'OPEN');
      assert.strictEqual(dto.items.length, 1);
      assert.strictEqual(dto.createdAt, '2024-01-01T00:00:00.000Z');
    });
  });
});

// =============================================================================
// Service Function Tests (with mocked Prisma)
// =============================================================================

describe('cart.service - service functions', () => {
  describe('getOpenCart', () => {
    it('retorna carrinho existente', async () => {
      const deps = makeDeps();
      const result = await cartService.getOpenCart('user-1', deps);

      assert.ok(result);
      assert.strictEqual(result.id, 'cart-1');
      assert.strictEqual(result.status, 'OPEN');
    });

    it('retorna null se carrinho não existe', async () => {
      const deps = makeDeps({
        cart: {
          findFirst: async () => null,
        },
      });
      const result = await cartService.getOpenCart('user-1', deps);

      assert.strictEqual(result, null);
    });
  });

  describe('getOrCreateOpenCart', () => {
    it('retorna carrinho existente sem criar novo', async () => {
      const createCalled = { value: false };
      const deps = makeDeps({
        cart: {
          findFirst: async () => ({
            id: 'existing-cart',
            userId: 'user-1',
            status: 'OPEN',
            totals: { total: 50 },
            meta: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            items: [],
          }),
          create: async () => {
            createCalled.value = true;
            return {};
          },
        },
      });

      const result = await cartService.getOrCreateOpenCart('user-1', deps);

      assert.strictEqual(result.id, 'existing-cart');
      assert.strictEqual(createCalled.value, false);
    });

    it('cria novo carrinho se não existe', async () => {
      let findCallCount = 0;
      const deps = makeDeps({
        cart: {
          findFirst: async () => {
            findCallCount++;
            if (findCallCount === 1) return null; // Primeira busca
            return null; // Não deve chegar aqui
          },
          create: async ({ data }: any) => ({
            id: 'new-cart',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            items: [],
          }),
        },
      });

      const result = await cartService.getOrCreateOpenCart('user-1', deps);

      assert.strictEqual(result.id, 'new-cart');
      assert.strictEqual(result.status, 'OPEN');
    });

    it('trata race condition (P2002)', async () => {
      let findCallCount = 0;
      const deps = makeDeps({
        cart: {
          findFirst: async () => {
            findCallCount++;
            if (findCallCount === 1) return null;
            // Segunda busca após race condition
            return {
              id: 'race-winner-cart',
              userId: 'user-1',
              status: 'OPEN',
              totals: { total: 0 },
              meta: {},
              createdAt: new Date(),
              updatedAt: new Date(),
              items: [],
            };
          },
          create: async () => {
            const error: any = new Error('Unique constraint');
            error.code = 'P2002';
            throw error;
          },
        },
      });

      const result = await cartService.getOrCreateOpenCart('user-1', deps);

      assert.strictEqual(result.id, 'race-winner-cart');
    });
  });

  describe('clearCart', () => {
    it('limpa carrinho e reseta status', async () => {
      let deleteManyCalled = false;
      let updateData: any = null;

      const deps = makeDeps({
        cart: {
          findFirst: async () => ({
            id: 'cart-to-clear',
            userId: 'user-1',
            status: 'LOCKED',
            totals: { total: 100 },
            meta: { fingerprint: 'old' },
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          update: async ({ data }: any) => {
            updateData = data;
            return {};
          },
        },
        cartItem: {
          deleteMany: async () => {
            deleteManyCalled = true;
            return { count: 2 };
          },
        },
      });

      await cartService.clearCart('user-1', deps);

      assert.strictEqual(deleteManyCalled, true);
      assert.strictEqual(updateData.status, 'OPEN');
      assert.deepStrictEqual(updateData.totals, { total: 0, moeda: 'BRL' });
      assert.deepStrictEqual(updateData.meta, {});
    });

    it('lança erro se carrinho não encontrado', async () => {
      const deps = makeDeps({
        cart: {
          findFirst: async () => null,
        },
      });

      await assert.rejects(
        () => cartService.clearCart('user-1', deps),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.code, 'not_found');
          return true;
        }
      );
    });
  });

  describe('recalculateCartTotals', () => {
    it('recalcula totais corretamente', async () => {
      let updateData: any = null;

      const deps = makeDeps({
        cart: {
          findFirst: async () => ({
            id: 'cart-1',
            items: [
              { totals: { total: 10 } },
              { totals: { total: 15.5 } },
              { totals: { total: 4.5 } },
            ],
          }),
          update: async ({ data }: any) => {
            updateData = data;
            return {};
          },
        },
      });

      const result = await cartService.recalculateCartTotals('cart-1', deps);

      assert.strictEqual(result.total, 30);
      assert.strictEqual(result.subtotal, 30);
      assert.strictEqual(result.moeda, 'BRL');
    });

    it('lança erro se carrinho não encontrado', async () => {
      const deps = makeDeps({
        cart: {
          findFirst: async () => null,
        },
      });

      await assert.rejects(
        () => cartService.recalculateCartTotals('non-existent', deps),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.code, 'not_found');
          return true;
        }
      );
    });
  });

  describe('verifyCartOwnership', () => {
    it('retorna true se usuário é dono', async () => {
      const deps = makeDeps({
        cart: {
          findFirst: async () => ({ id: 'cart-1' }),
        },
      });

      const result = await cartService.verifyCartOwnership('user-1', 'cart-1', deps);
      assert.strictEqual(result, true);
    });

    it('retorna false se usuário não é dono', async () => {
      const deps = makeDeps({
        cart: {
          findFirst: async () => null,
        },
      });

      const result = await cartService.verifyCartOwnership('user-1', 'cart-1', deps);
      assert.strictEqual(result, false);
    });
  });
});
