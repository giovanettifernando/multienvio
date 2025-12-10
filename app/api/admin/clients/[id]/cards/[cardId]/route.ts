/**
 * PUT/DELETE /api/admin/clients/[id]/cards/[cardId]
 *
 * Gerencia cartão específico de um usuário (Admin)
 * Apenas permite definir como default ou remover
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/lib/logger';

const updateCardSchema = z.object({
  isDefault: z.boolean(),
});

// PUT - Definir cartão como default
export const PUT = withApiHandler<unknown, { id: string; cardId: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id: userId, cardId } = params;
  const body = await req.json();

  const validation = updateCardSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  // Verificar se cartão existe e pertence ao usuário
  const existing = await prisma.card.findFirst({
    where: { id: cardId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Cartão não encontrado',
      status: 404,
    });
  }

  const { isDefault } = validation.data;

  if (isDefault) {
    // Remover default de outros cartões
    await prisma.card.updateMany({
      where: { userId, isDefault: true, id: { not: cardId } },
      data: { isDefault: false },
    });
  }

  const card = await prisma.card.update({
    where: { id: cardId },
    data: { isDefault },
    select: {
      id: true,
      brand: true,
      holderName: true,
      last4: true,
      expMonth: true,
      expYear: true,
      isDefault: true,
    },
  });

  logger.info({
    event: 'admin_update_card',
    adminId: authResult.user.id,
    userId,
    cardId,
    isDefault,
  }, 'Admin updated card');

  return { data: { message: 'Cartão atualizado com sucesso', card } };
});

// DELETE - Remover cartão
export const DELETE = withApiHandler<unknown, { id: string; cardId: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id: userId, cardId } = params;

  // Verificar se cartão existe e pertence ao usuário
  const existing = await prisma.card.findFirst({
    where: { id: cardId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Cartão não encontrado',
      status: 404,
    });
  }

  await prisma.card.delete({
    where: { id: cardId },
  });

  logger.info({
    event: 'admin_delete_card',
    adminId: authResult.user.id,
    userId,
    cardId,
  }, 'Admin deleted card');

  return { data: { message: 'Cartão removido com sucesso' } };
});
