import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { logger } from '@/platform/logging/logger';

const updateChargebackSchema = z.object({
  status: z.enum(['pending', 'won', 'lost', 'cancelled']),
  notes: z.string().optional(),
});

interface UpdateChargebackResponse {
  ok: boolean;
}

export const POST = withApiHandler<UpdateChargebackResponse, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const rateLimitError = await rateLimitByUser(session.staffId, 'chargeback_update', RATE_LIMITS.FINANCE);
  if (rateLimitError) {
    throw new ApiError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      status: 429,
    });
  }

  const { id } = params;
  const body = await req.json();

  const parsed = updateChargebackSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { status, notes } = parsed.data;

  // TODO: Implementar atualização real no banco de dados
  logger.debug({ event: 'chargeback_update', id, status, notes }, 'Updating chargeback');

  return { data: { ok: true } };
});
