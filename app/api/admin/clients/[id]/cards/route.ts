/**
 * GET /api/admin/clients/[id]/cards
 *
 * Gerencia cartões de um usuário da plataforma (Admin)
 * Nota: Admin não pode adicionar cartões, apenas visualizar e remover
 */

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';

// GET - Listar cartões (sem dados sensíveis)
export const GET = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const userId = params.id;

  const cards = await prisma.card.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      brand: true,
      holderName: true,
      last4: true,
      expMonth: true,
      expYear: true,
      isDefault: true,
      createdAt: true,
    },
  });

  return { data: { cards } };
});
