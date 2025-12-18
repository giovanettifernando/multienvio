/**
 * Cart Item API Route
 *
 * PATCH  /api/cart/items/[id] - Atualiza um item do carrinho
 * DELETE /api/cart/items/[id] - Remove um item do carrinho
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { logger } from '@/platform/logging/logger';
import { updateCartItemSchema } from '@/modules/cart/dto/cart';
import { updateItem, deleteItem, type CartItemDto } from '@/modules/cart/application';

// =============================================================================
// Response Types
// =============================================================================

type PatchCartItemResponse = {
  message: string;
  item: CartItemDto;
};

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
 * PATCH /api/cart/items/[id]
 * Atualiza um item do carrinho
 */
export const PATCH = withApiHandler<PatchCartItemResponse, CartItemParams>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const itemId = context.params.id;
  const body = await context.req.json();

  // Validação com Zod
  const validation = updateCartItemSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'cart_item_update_validation_error', errors: validation.error.flatten() }, 'Validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const item = await updateItem(session.userId, itemId, validation.data);

  return {
    data: {
      message: 'Item atualizado',
      item,
    },
  };
});

/**
 * DELETE /api/cart/items/[id]
 * Remove um item do carrinho
 */
export const DELETE = withApiHandler<DeleteCartItemResponse, CartItemParams>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const itemId = context.params.id;

  await deleteItem(session.userId, itemId);

  return {
    data: {
      message: 'Item removido do carrinho',
    },
  };
});
