/**
 * API routes for /api/admin/clients/[id]
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { NextResponse } from 'next/server';

interface AdminClientUpdateResponse {
  ok: boolean;
}

interface AdminClientDeleteResponse {
  ok: boolean;
  message: string;
}

export const PUT = withApiHandler<AdminClientUpdateResponse, { id: string }>(async (context) => {
  const { req, logger } = context;

  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado ou sem permissão', status: 401 });
  }

  logger.info('admin_client_update', { adminId: authResult.user.id });

  // Mock: apenas retorna sucesso
  return { data: { ok: true } };
});

export const DELETE = withApiHandler<AdminClientDeleteResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado ou sem permissão', status: 401 });
  }

  const { id: userId } = params;

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

  // Excluir usuário e dados relacionados (cascade configurado no Prisma)
  await prisma.user.delete({
    where: { id: userId },
  });

  logger.info('admin_delete_user', {
    adminId: authResult.user.id,
    adminEmail: authResult.user.email,
    deletedUserId: userId,
    deletedUserEmail: user.email,
  });

  return {
    data: {
      ok: true,
      message: 'Conta excluída com sucesso',
    },
  };
});
