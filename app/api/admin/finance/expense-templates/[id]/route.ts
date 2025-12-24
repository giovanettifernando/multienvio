/**
 * DELETE /api/admin/finance/expense-templates/[id] - Desativa template
 * PATCH /api/admin/finance/expense-templates/[id] - Incrementa uso
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';

interface IncrementTemplateUsageResponse {
  ok: boolean;
}

// Incrementar contador de uso
export const PATCH = withApiHandler<IncrementTemplateUsageResponse, { id: string }>(async ({ req, params }) => {
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

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
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const { id } = params;

  await prisma.expenseTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  return {
    data: { ok: true },
  };
});
