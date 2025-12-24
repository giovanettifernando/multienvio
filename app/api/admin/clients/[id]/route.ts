/**
 * API routes for /api/admin/clients/[id]
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

import { AdminPermission } from '@prisma/client';

interface AdminClientUpdateResponse {
  ok: boolean;
}

interface AdminClientDeleteResponse {
  ok: boolean;
  message: string;
}

export const PUT = withApiHandler<AdminClientUpdateResponse, { id: string }>(async (context) => {
  const { req, logger } = context;

  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  logger.info('admin_client_update', { adminId: session.staffId });

  // TODO: Implementar atualização real de cliente
  return { data: { ok: true } };
});

export const DELETE = withApiHandler<AdminClientDeleteResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await requireAdminSession(req, AdminPermission.CONTAS);

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
    adminId: session.staffId,
    adminEmail: session.email,
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
