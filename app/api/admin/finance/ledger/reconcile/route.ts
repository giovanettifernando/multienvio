import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { logger } from '@/platform/logging/logger';

const reconcileSchema = z.object({
  ids: z.array(z.string()).min(1, 'Pelo menos um ID deve ser fornecido'),
});

interface ReconcileResponse {
  ok: boolean;
}

export const POST = withApiHandler<ReconcileResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const rateLimitError = await rateLimitByUser(session.staffId, 'ledger_reconcile', RATE_LIMITS.FINANCE);
  if (rateLimitError) {
    throw new ApiError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      status: 429,
    });
  }

  const body = await req.json();

  const parsed = reconcileSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { ids } = parsed.data;

  // TODO: Implementar atualização real no banco de dados
  logger.debug({ event: 'reconcile_ledger', ids }, 'Reconciling ledger entries');

  return { data: { ok: true } };
});
