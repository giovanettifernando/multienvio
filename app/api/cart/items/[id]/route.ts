/**
 * Cart Item API Route
 *
 * DELETE /api/cart/items/[id] - Remove um item do carrinho
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireUserSession } from '@/platform/auth/require-session';
import { deleteItem } from '@/modules/cart/application';

// =============================================================================
// Response Types
// =============================================================================

type DeleteCartItemResponse = {
  message: string;
};

type CartItemParams = {
  id: string;
};

// =============================================================================
// Handlers
// =============================================================================

/**
 * DELETE /api/cart/items/[id]
 * Remove um item do carrinho
 */
export const DELETE = withApiHandler<DeleteCartItemResponse, CartItemParams>(async (context) => {
  const session = await requireUserSession(context.req);

  const itemId = context.params.id;

  await deleteItem(session.userId, itemId);

  return {
    data: {
      message: 'Item removido do carrinho',
    },
  };
});
