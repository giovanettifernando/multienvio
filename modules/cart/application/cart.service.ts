/**
 * Cart Service
 *
 * Gerencia operações CRUD do carrinho de compras.
 * Extrai lógica de negócio das rotas para facilitar testes e reutilização.
 *
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { logger as defaultLogger } from '@/platform/logging/logger';
import { ApiError } from '@/platform/api/errors';
import type { Prisma, Cart, CartItem, PrismaClient } from '@prisma/client';

// =============================================================================
// Types & DTOs
// =============================================================================

export interface CartTotals {
  subtotal?: number;
  total: number;
  moeda: string;
}

export interface CartItemDto {
  id: string;
  originAddress: Prisma.JsonValue;
  destination: Prisma.JsonValue;
  volumes: Prisma.JsonValue;
  preferences: Prisma.JsonValue;
  insuranceValue?: number;
  pickupPoint: Prisma.JsonValue;
  pickupFee?: Prisma.JsonValue;
  selectedQuote: Prisma.JsonValue;
  totals: Prisma.JsonValue;
  document?: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface CartDto {
  id: string;
  status: string;
  totals: Prisma.JsonValue;
  meta: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
  items: CartItemDto[];
}

type CartWithItems = Cart & { items: CartItem[] };

// Dependency injection interface
export interface CartServiceDeps {
  prisma: PrismaClient | any;
  logger?: typeof defaultLogger;
}

// Default deps
const defaultDeps: CartServiceDeps = {
  prisma: defaultPrisma,
  logger: defaultLogger,
};

// =============================================================================
// Mappers (exported for testing)
// =============================================================================

export function mapCartItemToDto(item: CartItem): CartItemDto {
  return {
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
  };
}

export function mapCartToDto(cart: CartWithItems): CartDto {
  return {
    id: cart.id,
    status: cart.status,
    totals: cart.totals,
    meta: cart.meta,
    createdAt: cart.createdAt.toISOString(),
    updatedAt: cart.updatedAt.toISOString(),
    items: cart.items.map(mapCartItemToDto),
  };
}

/**
 * Calcula o total do carrinho a partir dos itens.
 * Função pura para facilitar testes.
 */
export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotals = item.totals as { total?: number };
    const itemTotal = itemTotals?.total || 0;
    return sum + Number(itemTotal);
  }, 0);
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Busca o carrinho OPEN do usuário.
 * Retorna null se não existir.
 */
export async function getOpenCart(
  userId: string,
  deps: CartServiceDeps = defaultDeps
): Promise<CartDto | null> {
  const { prisma } = deps;

  const cart = await prisma.cart.findFirst({
    where: {
      userId,
      status: 'OPEN',
    },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return cart ? mapCartToDto(cart) : null;
}

/**
 * Busca ou cria o carrinho OPEN do usuário.
 * Trata race condition quando dois requests tentam criar simultaneamente.
 *
 * REGRA: Cada usuário pode ter apenas 1 carrinho OPEN (enforced by unique index)
 */
export async function getOrCreateOpenCart(
  userId: string,
  deps: CartServiceDeps = defaultDeps
): Promise<CartDto> {
  const { prisma, logger } = deps;

  // Tentar buscar primeiro
  let cart = await prisma.cart.findFirst({
    where: {
      userId,
      status: 'OPEN',
    },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (cart) {
    return mapCartToDto(cart);
  }

  // Criar novo carrinho
  try {
    cart = await prisma.cart.create({
      data: {
        userId,
        status: 'OPEN',
        totals: { total: 0, moeda: 'BRL' },
      },
      include: {
        items: true,
      },
    });
    return mapCartToDto(cart);
  } catch (error: unknown) {
    // Race condition: outro request criou o carrinho
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      logger?.debug?.({ event: 'cart_race_condition', userId }, 'Cart race condition handled');

      cart = await prisma.cart.findFirst({
        where: {
          userId,
          status: 'OPEN',
        },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!cart) {
        throw new ApiError({
          code: 'cart_error',
          message: 'Falha ao criar/buscar carrinho',
          status: 500,
        });
      }

      return mapCartToDto(cart);
    }

    throw error;
  }
}

/**
 * Limpa o carrinho do usuário (remove todos os itens e reseta para OPEN).
 * Aceita carrinho OPEN ou LOCKED.
 */
export async function clearCart(
  userId: string,
  deps: CartServiceDeps = defaultDeps
): Promise<void> {
  const { prisma, logger } = deps;

  // Buscar carrinho OPEN ou LOCKED
  const cart = await prisma.cart.findFirst({
    where: {
      userId,
      status: { in: ['OPEN', 'LOCKED'] },
    },
  });

  if (!cart) {
    throw new ApiError({
      code: 'not_found',
      message: 'Carrinho não encontrado',
      status: 404,
    });
  }

  // Remover todos os itens
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  // Resetar carrinho
  await prisma.cart.update({
    where: { id: cart.id },
    data: {
      status: 'OPEN',
      totals: { total: 0, moeda: 'BRL' },
      meta: {}, // Limpar fingerprint e histórico de checkout
      updatedAt: new Date(),
    },
  });

  logger?.info?.({ event: 'cart_cleared', userId, cartId: cart.id }, 'Cart cleared');
}

/**
 * Recalcula os totais do carrinho com base nos itens.
 * Função interna usada após adicionar/atualizar/remover itens.
 */
export async function recalculateCartTotals(
  cartId: string,
  deps: CartServiceDeps = defaultDeps
): Promise<CartTotals> {
  const { prisma } = deps;

  const cart = await prisma.cart.findFirst({
    where: { id: cartId },
    include: { items: true },
  });

  if (!cart) {
    throw new ApiError({
      code: 'not_found',
      message: 'Carrinho não encontrado',
      status: 404,
    });
  }

  const cartTotal = calculateCartTotal(cart.items);

  const newTotals: CartTotals = {
    subtotal: cartTotal,
    total: cartTotal,
    moeda: 'BRL',
  };

  await prisma.cart.update({
    where: { id: cartId },
    data: {
      totals: newTotals as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });

  return newTotals;
}

/**
 * Busca o carrinho OPEN do usuário e retorna o ID.
 * Usado internamente para operações de items.
 */
export async function getOpenCartId(
  userId: string,
  deps: CartServiceDeps = defaultDeps
): Promise<string | null> {
  const { prisma } = deps;

  const cart = await prisma.cart.findFirst({
    where: {
      userId,
      status: 'OPEN',
    },
    select: { id: true },
  });

  return cart?.id ?? null;
}

/**
 * Verifica se o usuário é dono do carrinho.
 */
export async function verifyCartOwnership(
  userId: string,
  cartId: string,
  deps: CartServiceDeps = defaultDeps
): Promise<boolean> {
  const { prisma } = deps;

  const cart = await prisma.cart.findFirst({
    where: {
      id: cartId,
      userId,
    },
    select: { id: true },
  });

  return !!cart;
}
