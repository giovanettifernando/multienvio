/**
 * Recurring Items Service
 *
 * Gerencia CRUD de itens recorrentes do usuário.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { ApiError } from '@/platform/api/errors';
import type { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface RecurringItemDto {
  id: string;
  userId: string;
  descricao: string;
  valorUnitario: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringItemInput {
  descricao: string;
  valorUnitario: number;
}

export interface UpdateRecurringItemInput {
  descricao?: string;
  valorUnitario?: number;
}

export interface RecurringItemsServiceDeps {
  prisma: PrismaClient | any;
}

const defaultDeps: RecurringItemsServiceDeps = {
  prisma: defaultPrisma,
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Lista todos os itens recorrentes do usuário.
 */
export async function listUserItems(
  userId: string,
  deps: RecurringItemsServiceDeps = defaultDeps
): Promise<RecurringItemDto[]> {
  const { prisma } = deps;

  const items = await prisma.recurringItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return items.map(mapItemToDto);
}

/**
 * Cria um novo item recorrente.
 */
export async function createItem(
  userId: string,
  input: CreateRecurringItemInput,
  deps: RecurringItemsServiceDeps = defaultDeps
): Promise<RecurringItemDto> {
  const { prisma } = deps;
  const { descricao, valorUnitario } = input;

  const item = await prisma.recurringItem.create({
    data: {
      userId,
      descricao,
      valorUnitario,
    },
  });

  return mapItemToDto(item);
}

/**
 * Atualiza um item recorrente.
 */
export async function updateItem(
  userId: string,
  itemId: string,
  input: UpdateRecurringItemInput,
  deps: RecurringItemsServiceDeps = defaultDeps
): Promise<RecurringItemDto> {
  const { prisma } = deps;

  // Verify ownership
  const existing = await prisma.recurringItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!existing) {
    throw new ApiError({ code: 'not_found', message: 'Item não encontrado', status: 404 });
  }

  const item = await prisma.recurringItem.update({
    where: { id: itemId },
    data: {
      ...(input.descricao && { descricao: input.descricao }),
      ...(input.valorUnitario !== undefined && { valorUnitario: input.valorUnitario }),
    },
  });

  return mapItemToDto(item);
}

/**
 * Remove um item recorrente.
 */
export async function deleteItem(
  userId: string,
  itemId: string,
  deps: RecurringItemsServiceDeps = defaultDeps
): Promise<void> {
  const { prisma } = deps;

  // Verify ownership
  const existing = await prisma.recurringItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!existing) {
    throw new ApiError({ code: 'not_found', message: 'Item não encontrado', status: 404 });
  }

  await prisma.recurringItem.delete({
    where: { id: itemId },
  });
}

/**
 * Maps database item to DTO.
 */
function mapItemToDto(item: any): RecurringItemDto {
  return {
    id: item.id,
    userId: item.userId,
    descricao: item.descricao,
    valorUnitario: Number(item.valorUnitario),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
