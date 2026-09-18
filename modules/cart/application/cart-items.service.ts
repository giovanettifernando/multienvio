/**
 * Cart Items Service
 *
 * Gerencia operações de itens do carrinho.
 * Extrai lógica de negócio das rotas para facilitar testes e reutilização.
 *
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { logger as defaultLogger } from '@/platform/logging/logger';
import { ApiError } from '@/platform/api/errors';
import type { Prisma, CartItem, PrismaClient } from '@prisma/client';
import {
  getOrCreateOpenCart,
  recalculateCartTotals,
  type CartServiceDeps,
} from './cart.service';
import type { AddCartItemInput, UpdateCartItemInput } from '../dto/cart';

// =============================================================================
// DTOs
// =============================================================================

export interface CartItemDto {
  id: string;
  originAddress: Prisma.JsonValue;
  destination: Prisma.JsonValue;
  volumes: Prisma.JsonValue;
  preferences: Prisma.JsonValue;
  insuranceValue?: number;
  selectedQuote: Prisma.JsonValue;
  totals: Prisma.JsonValue;
  document?: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
}

// Dependency injection interface (same as cart.service)
export interface CartItemsServiceDeps {
  prisma: PrismaClient | any;
  logger?: typeof defaultLogger;
}

// Default deps
const defaultDeps: CartItemsServiceDeps = {
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
    selectedQuote: item.selectedQuote,
    totals: item.totals,
    document: item.document,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Adiciona um item ao carrinho do usuário.
 * Cria o carrinho automaticamente se não existir.
 * Recalcula os totais após adicionar.
 */
export async function addItem(
  userId: string,
  data: AddCartItemInput,
  deps: CartItemsServiceDeps = defaultDeps
): Promise<CartItemDto> {
  const { prisma, logger } = deps;

  // Buscar ou criar carrinho OPEN (trata race condition)
  const cart = await getOrCreateOpenCart(userId, deps as CartServiceDeps);

  // Criar item no carrinho
  const item = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      originAddress: data.originAddress as Prisma.InputJsonValue,
      destination: data.destination as Prisma.InputJsonValue,
      volumes: data.volumes as Prisma.InputJsonValue,
      preferences: data.preferences as Prisma.InputJsonValue,
      insuranceValue: data.insuranceValue,
      selectedQuote: data.selectedQuote as Prisma.InputJsonValue,
      totals: data.totals as Prisma.InputJsonValue,
      document: (data.document || null) as Prisma.InputJsonValue,
    },
  });

  // Recalcular totais do carrinho
  await recalculateCartTotals(cart.id, deps as CartServiceDeps);

  logger?.info?.(
    { event: 'cart_item_added', userId, cartId: cart.id, itemId: item.id },
    'Item added to cart'
  );

  return mapCartItemToDto(item);
}

/**
 * Atualiza um item do carrinho.
 * Verifica propriedade e recalcula totais após atualizar.
 */
export async function updateItem(
  userId: string,
  itemId: string,
  data: UpdateCartItemInput,
  deps: CartItemsServiceDeps = defaultDeps
): Promise<CartItemDto> {
  const { prisma, logger } = deps;

  // Verificar que o item pertence ao carrinho do usuário
  const existingItem = await prisma.cartItem.findFirst({
    where: { id: itemId },
    include: { cart: true },
  });

  if (!existingItem || existingItem.cart.userId !== userId) {
    throw new ApiError({
      code: 'not_found',
      message: 'Item não encontrado',
      status: 404,
    });
  }

  // Construir objeto de atualização apenas com campos fornecidos
  const updateData: Prisma.CartItemUpdateInput = {
    updatedAt: new Date(),
  };

  if (data.originAddress) {
    updateData.originAddress = data.originAddress as Prisma.InputJsonValue;
  }
  if (data.destination) {
    updateData.destination = data.destination as Prisma.InputJsonValue;
  }
  if (data.volumes) {
    updateData.volumes = data.volumes as Prisma.InputJsonValue;
  }
  if (data.preferences) {
    updateData.preferences = data.preferences as Prisma.InputJsonValue;
  }
  if (data.insuranceValue !== undefined) {
    updateData.insuranceValue = data.insuranceValue;
  }
  if (data.selectedQuote) {
    updateData.selectedQuote = data.selectedQuote as Prisma.InputJsonValue;
  }
  if (data.totals) {
    updateData.totals = data.totals as Prisma.InputJsonValue;
  }
  if (data.document !== undefined) {
    updateData.document = (data.document || null) as Prisma.InputJsonValue;
  }

  const updatedItem = await prisma.cartItem.update({
    where: { id: itemId },
    data: updateData,
  });

  // Recalcular totais do carrinho
  await recalculateCartTotals(existingItem.cartId, deps as CartServiceDeps);

  logger?.info?.(
    { event: 'cart_item_updated', userId, cartId: existingItem.cartId, itemId },
    'Cart item updated'
  );

  return mapCartItemToDto(updatedItem);
}

/**
 * Remove um item do carrinho.
 * Verifica propriedade e recalcula totais após remover.
 */
export async function deleteItem(
  userId: string,
  itemId: string,
  deps: CartItemsServiceDeps = defaultDeps
): Promise<void> {
  const { prisma, logger } = deps;

  // Verificar que o item pertence ao carrinho do usuário
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId },
    include: { cart: true },
  });

  if (!item || item.cart.userId !== userId) {
    throw new ApiError({
      code: 'not_found',
      message: 'Item não encontrado',
      status: 404,
    });
  }

  const cartId = item.cartId;

  // Remover item
  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  // Recalcular totais do carrinho
  await recalculateCartTotals(cartId, deps as CartServiceDeps);

  logger?.info?.(
    { event: 'cart_item_deleted', userId, cartId, itemId },
    'Cart item deleted'
  );
}

/**
 * Lista todos os itens do carrinho do usuário.
 */
export async function listItems(
  userId: string,
  deps: CartItemsServiceDeps = defaultDeps
): Promise<CartItemDto[]> {
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

  if (!cart) {
    return [];
  }

  return cart.items.map(mapCartItemToDto);
}

/**
 * Obtém um item específico do carrinho.
 * Verifica propriedade.
 */
export async function getItem(
  userId: string,
  itemId: string,
  deps: CartItemsServiceDeps = defaultDeps
): Promise<CartItemDto | null> {
  const { prisma } = deps;

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId },
    include: { cart: true },
  });

  if (!item || item.cart.userId !== userId) {
    return null;
  }

  return mapCartItemToDto(item);
}
