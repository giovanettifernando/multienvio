/**
 * DELETE /api/admin/finance/expense-templates/[id] - Desativa template
 * PATCH /api/admin/finance/expense-templates/[id] - Incrementa uso
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';

interface IncrementTemplateUsageResponse {
  ok: boolean;
}

// Incrementar contador de uso
export const PATCH = withApiHandler<IncrementTemplateUsageResponse, { id: string }>(async ({ req, params }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.FINANCEIRO)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

  const { id } = params;

  await prisma.expenseTemplate.update({
    where: { id },
    data: {
      usageCount: { increment: 1 },
    },
  });

  return {
    data: { ok: true },
  };
});

interface DeactivateTemplateResponse {
  ok: boolean;
}

// Desativar template (soft delete)
export const DELETE = withApiHandler<DeactivateTemplateResponse, { id: string }>(async ({ req, params }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.FINANCEIRO)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

  const { id } = params;

  await prisma.expenseTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  return {
    data: { ok: true },
  };
});
