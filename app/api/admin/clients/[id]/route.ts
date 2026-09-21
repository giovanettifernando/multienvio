/**
 * API routes for /api/admin/clients/[id]
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { sessionCache, userCache } from '@/platform/cache/cache';
import { logAdminAction } from '@/platform/logging/audit-admin';
import { z } from 'zod';

import { AdminPermission } from '@prisma/client';

interface AdminClientUpdateResponse {
  ok: boolean;
}

interface AdminClientDeleteResponse {
  ok: boolean;
  message: string;
}

const AdminClientUpdateSchema = z.object({
  status: z.enum(['active', 'pending', 'blocked', 'suspended']),
});

/** Troca o status da conta (tela "Detalhes da Conta"). Dados cadastrais vão por /profile. */
export const PUT = withApiHandler<AdminClientUpdateResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const parsed = AdminClientUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { id: userId } = params;
  const { status } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user) {
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

  if (user.status !== status) {
    await prisma.user.update({ where: { id: userId }, data: { status } });

    // O proxy confia no status guardado no Redis no login: sem revogar, a
    // mudança só valeria quando a sessão expirasse (7 dias).
    await sessionCache.incrementTokenVersion(userId);
    userCache.invalidate(userId).catch(() => {});

    await logAdminAction(session.staffId, 'client_status_change', 'User', userId, {
      from: user.status,
      to: status,
    });
  }

  logger.info('admin_client_update', { adminId: session.staffId, userId, status });

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

  // Derruba as sessões abertas: o token de quem foi excluído seguia aceito.
  await sessionCache.incrementTokenVersion(userId);
  userCache.invalidate(userId).catch(() => {});

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
