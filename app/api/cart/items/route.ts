import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import { addCartItemSchema } from '@/shared/validation/cart';
import { logger } from '@/platform/logging/logger';
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
  pickupFee: Prisma.JsonValue;
  selectedQuote: Prisma.JsonValue;
  totals: Prisma.JsonValue;
  document: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

// Tipo para resposta POST /api/cart/items
type PostCartItemResponse = {
  message: string;
  item: CartItemResponse;
};

/**
 * POST /api/cart/items
 * Adiciona um item ao carrinho
 */
export const POST = withApiHandler<PostCartItemResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

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

  const data = validation.data;

  // Buscar ou criar carrinho OPEN do usuário
  let cart = await prisma.cart.findFirst({
    where: {
      userId: session.userId,
      status: 'OPEN',
    },
    include: {
      items: true,
    },
  });

  // Se não existir, criar um novo carrinho
  if (!cart) {
    try {
      cart = await prisma.cart.create({
        data: {
          userId: session.userId,
          status: 'OPEN',
          totals: { total: 0, moeda: 'BRL' },
        },
        include: {
          items: true,
        },
      });
    } catch (error: unknown) {
      // Se falhar por unique constraint, outro request criou o carrinho
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        cart = await prisma.cart.findFirst({
          where: {
            userId: session.userId,
            status: 'OPEN',
          },
          include: {
            items: true,
          },
        });
        if (!cart) {
          throw new ApiError({ code: 'cart_error', message: 'Falha ao criar/buscar carrinho', status: 500 });
        }
      } else {
        throw error;
      }
    }
  }

  // Criar item no carrinho
  const item = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      originAddress: data.originAddress as Prisma.InputJsonValue,
      destination: data.destination as Prisma.InputJsonValue,
      volumes: data.volumes as Prisma.InputJsonValue,
      preferences: data.preferences as Prisma.InputJsonValue,
      insuranceValue: data.insuranceValue,
      pickupPoint: (data.pickupPoint || null) as Prisma.InputJsonValue,
      pickupFee: (data.pickupFee || null) as Prisma.InputJsonValue,
      selectedQuote: data.selectedQuote as Prisma.InputJsonValue,
      totals: data.totals as Prisma.InputJsonValue,
      document: (data.document || null) as Prisma.InputJsonValue,
    },
  });

  // Recalcular totals do carrinho
  const updatedCart = await prisma.cart.findFirst({
    where: { id: cart.id },
    include: { items: true },
  });

  if (updatedCart) {
    const cartTotal = updatedCart.items.reduce((sum, item) => {
      const itemTotals = item.totals as { total?: number };
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
      message: 'Item adicionado ao carrinho',
      item: {
        id: item.id,
        originAddress: item.originAddress,
        destination: item.destination,
        volumes: item.volumes,
        preferences: item.preferences,
        insuranceValue: item.insuranceValue ? Number(item.insuranceValue) : undefined,
        pickupPoint: item.pickupPoint,
        pickupFee: item.pickupFee,
        selectedQuote: item.selectedQuote,
        totals: item.totals,
        document: item.document,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    },
  };
});
