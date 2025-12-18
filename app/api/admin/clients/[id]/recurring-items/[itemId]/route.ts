/**
 * PUT/DELETE /api/admin/clients/[id]/recurring-items/[itemId]
 *
 * Atualiza ou remove item recorrente de um usuário (Admin)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/platform/logging/logger';

const itemSchema = z.object({
  descricao: z.string().min(1).optional(),
  valorUnitario: z.number().min(0).optional(),
});

// PUT - Atualizar item recorrente
export const PUT = withApiHandler<unknown, { id: string; itemId: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id: userId, itemId } = params;
  const body = await req.json();

  const validation = itemSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  // Verificar se item existe e pertence ao usuário
  const existing = await prisma.recurringItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Item não encontrado',
      status: 404,
    });
  }

  const { descricao, valorUnitario } = validation.data;

  const item = await prisma.recurringItem.update({
    where: { id: itemId },
    data: {
      ...(descricao !== undefined && { descricao }),
      ...(valorUnitario !== undefined && { valorUnitario }),
    },
  });

  logger.info({
    event: 'admin_update_recurring_item',
    adminId: authResult.user.id,
    userId,
    itemId,
  }, 'Admin updated recurring item');

  return { data: { message: 'Item atualizado com sucesso', item } };
});

// DELETE - Remover item recorrente
export const DELETE = withApiHandler<unknown, { id: string; itemId: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id: userId, itemId } = params;

  // Verificar se item existe e pertence ao usuário
  const existing = await prisma.recurringItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Item não encontrado',
      status: 404,
    });
  }

  await prisma.recurringItem.delete({
    where: { id: itemId },
  });

  logger.info({
    event: 'admin_delete_recurring_item',
    adminId: authResult.user.id,
    userId,
    itemId,
  }, 'Admin deleted recurring item');

  return { data: { message: 'Item removido com sucesso' } };
});
