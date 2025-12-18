/**
 * Stores globais compartilhados entre rotas da API
 * Usa globalThis para persistência entre hot reloads
 */

import type { Cart } from '@/shared/types/cart';

// Cart Store
declare global {
  var __envioCart: Cart | undefined;
}

export function getCartStore(): Cart {
  if (!globalThis.__envioCart) {
    globalThis.__envioCart = {
      items: [],
      subtotal: 0,
      descontos: 0,
      taxas: 0,
      total: 0,
      currency: "BRL",
    };
  }
  return globalThis.__envioCart;
}

export function recomputeCartTotals(cart: Cart) {
  const subtotal = cart.items.reduce(
    (accumulator, item) => accumulator + item.preco * item.quantidade,
    0,
  );
  const descontos = 0;
  const taxas = 0;
  const total = subtotal - descontos + taxas;
  globalThis.__envioCart = { ...cart, subtotal, descontos, taxas, total };
}
