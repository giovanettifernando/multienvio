/**
 * Cart API Route
 *
 * GET  /api/cart - Retorna o carrinho OPEN do usuário com itens
 * DELETE /api/cart - Limpa o carrinho do usuário
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireUserSession } from '@/platform/auth/require-session';
import {
  getOrCreateOpenCart,
  clearCart,
  type CartDto,
} from '@/modules/cart/application';

// =============================================================================
// Response Types
// =============================================================================

type GetCartResponse = {
  cart: CartDto;
};

type DeleteCartResponse = {
  message: string;
  ok: boolean;
};

// =============================================================================
// Handlers
// =============================================================================

/**
 * GET /api/cart
 * Retorna o carrinho OPEN do usuário logado com seus itens
 */
export const GET = withApiHandler<GetCartResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const cart = await getOrCreateOpenCart(session.userId);

  return {
    data: { cart },
  };
});

/**
 * DELETE /api/cart
 * Limpa o carrinho do usuário (remove todos os itens)
 */
export const DELETE = withApiHandler<DeleteCartResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  await clearCart(session.userId);

  return {
    data: {
      message: 'Carrinho limpo com sucesso',
      ok: true,
    },
  };
});
