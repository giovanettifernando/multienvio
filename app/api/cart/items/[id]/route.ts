import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { updateCartItemSchema } from '@/lib/validation/cart';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

// Tipo para item do carrinho na resposta
type CartItemResponse = {
  id: string;
  originAddress: Prisma.JsonValue;
  destination: Prisma.JsonValue;
  volumes: Prisma.JsonValue;
  preferences: Prisma.JsonValue;
  insuranceValue?: number;
  pickupPoint: Prisma.JsonValue;
  selectedQuote: Prisma.JsonValue;
  totals: Prisma.JsonValue;
  document: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

// Tipo para resposta PATCH /api/cart/items/[id]
type PatchCartItemResponse = {
  message: string;
  item: CartItemResponse;
};

// Tipo para parâmetros da rota
type CartItemParams = {
  id: string;
};

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

  const data = validation.data;

  // Verificar que o item pertence ao carrinho do usuário
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId },
    include: { cart: true },
  });

  if (!item || item.cart.userId !== session.userId) {
    throw new ApiError({ code: 'not_found', message: 'Item não encontrado', status: 404 });
  }

  // Atualizar apenas os campos fornecidos
  const updateData: Prisma.CartItemUpdateInput = {
    updatedAt: new Date(),
  };

  if (data.originAddress) updateData.originAddress = data.originAddress as Prisma.InputJsonValue;
  if (data.destination) updateData.destination = data.destination as Prisma.InputJsonValue;
  if (data.volumes) updateData.volumes = data.volumes as Prisma.InputJsonValue;
  if (data.preferences) updateData.preferences = data.preferences as Prisma.InputJsonValue;
  if (data.insuranceValue !== undefined) updateData.insuranceValue = data.insuranceValue;
  if (data.pickupPoint !== undefined) updateData.pickupPoint = (data.pickupPoint || null) as Prisma.InputJsonValue;
  if (data.selectedQuote) updateData.selectedQuote = data.selectedQuote as Prisma.InputJsonValue;
  if (data.totals) updateData.totals = data.totals as Prisma.InputJsonValue;
  if (data.document !== undefined) updateData.document = (data.document || null) as Prisma.InputJsonValue;

  const updatedItem = await prisma.cartItem.update({
    where: { id: itemId },
    data: updateData,
  });

  // Recalcular totals do carrinho
  const cart = await prisma.cart.findFirst({
    where: { id: item.cartId },
    include: { items: true },
  });

  if (cart) {
    const cartTotal = cart.items.reduce((sum, cartItem) => {
      const itemTotals = cartItem.totals as { total?: number };
      const itemTotal = itemTotals?.total || 0;
      return sum + Number(itemTotal);
    }, 0);

    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        totals: {
          subtotal: cartTotal,
          total: cartTotal,
          moeda: 'BRL',
        },
        updatedAt: new Date(),
      },
    });
  }

  return {
    data: {
      message: 'Item atualizado',
      item: {
        id: updatedItem.id,
        originAddress: updatedItem.originAddress,
        destination: updatedItem.destination,
        volumes: updatedItem.volumes,
        preferences: updatedItem.preferences,
        insuranceValue: updatedItem.insuranceValue ? Number(updatedItem.insuranceValue) : undefined,
        pickupPoint: updatedItem.pickupPoint,
        selectedQuote: updatedItem.selectedQuote,
        totals: updatedItem.totals,
        document: updatedItem.document,
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
      },
    },
  };
});

// Tipo para resposta DELETE /api/cart/items/[id]
type DeleteCartItemResponse = {
  message: string;
};

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

  // Verificar que o item pertence ao carrinho do usuário
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId },
    include: { cart: true },
  });

  if (!item || item.cart.userId !== session.userId) {
    throw new ApiError({ code: 'not_found', message: 'Item não encontrado', status: 404 });
  }

  const cartId = item.cartId;

  // Remover item
  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  // Recalcular totals do carrinho
  const cart = await prisma.cart.findFirst({
    where: { id: cartId },
    include: { items: true },
  });

  if (cart) {
    const cartTotal = cart.items.reduce((sum, cartItem) => {
      const itemTotals = cartItem.totals as { total?: number };
      const itemTotal = itemTotals?.total || 0;
      return sum + Number(itemTotal);
    }, 0);

    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        totals: {
          subtotal: cartTotal,
          total: cartTotal,
          moeda: 'BRL',
        },
        updatedAt: new Date(),
      },
    });
  }

  return {
    data: {
      message: 'Item removido do carrinho',
    },
  };
});
