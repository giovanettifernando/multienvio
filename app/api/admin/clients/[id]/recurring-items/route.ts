/**
 * GET/POST /api/admin/clients/[id]/recurring-items
 *
 * Gerencia itens recorrentes de um usuário (Admin)
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

import { AdminPermission } from '@prisma/client';
import { logger } from '@/platform/logging/logger';

const itemSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  valorUnitario: z.number().min(0, 'Valor deve ser maior ou igual a zero'),
});

// GET - Listar itens recorrentes
export const GET = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = params.id;

  const items = await prisma.recurringItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return { data: { items } };
});

// POST - Criar novo item recorrente
export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = params.id;
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

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  const { descricao, valorUnitario } = validation.data;

  const item = await prisma.recurringItem.create({
    data: {
      userId,
      descricao,
      valorUnitario,
    },
  });

  logger.info({
    event: 'admin_create_recurring_item',
    adminId: session.staffId,
    userId,
    itemId: item.id,
  }, 'Admin created recurring item');

  return {
    data: { message: 'Item criado com sucesso', item },
    status: 201,
  };
});
