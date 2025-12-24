/**
 * Cart Items API Route
 *
 * POST /api/cart/items - Adiciona um item ao carrinho
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { logger } from '@/platform/logging/logger';
import { addCartItemSchema } from '@/modules/cart/dto/cart';
import { addItem, type CartItemDto } from '@/modules/cart/application';

// =============================================================================
// Response Types
// =============================================================================

type PostCartItemResponse = {
  message: string;
  item: CartItemDto;
};

// =============================================================================
// Handlers
// =============================================================================

/**
 * POST /api/cart/items
 * Adiciona um item ao carrinho
 */
export const POST = withApiHandler<PostCartItemResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const body = await context.req.json();

  // Validação com Zod
  const validation = addCartItemSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'cart_item_validation_error', errors: validation.error.flatten() }, 'Validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const item = await addItem(session.userId, validation.data);

  return {
    data: {
      message: 'Item adicionado ao carrinho',
      item,
    },
  };
});
