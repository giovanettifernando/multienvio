import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { logger } from '@/lib/logger';

const markPayoutPaidSchema = z.object({
  reference: z.string().min(1, 'Referência é obrigatória'),
  proofUrl: z.string().url('URL do comprovante inválida').optional(),
});

interface MarkPayoutPaidResponse {
  ok: boolean;
}

export const POST = withApiHandler<MarkPayoutPaidResponse, { id: string }>(async ({ req, params }) => {
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
      message: 'Sem permissão para acessar finanças',
      status: 403,
    });
  }

  const rateLimitError = await rateLimitByUser(session.staffId, 'payout_paid', RATE_LIMITS.FINANCE);
  if (rateLimitError) {
    throw new ApiError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      status: 429,
    });
  }

  const { id } = params;
  const body = await req.json();

  const parsed = markPayoutPaidSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { reference, proofUrl } = parsed.data;
  logger.debug({ event: 'mock_payout_paid', id, reference, proofUrl }, 'Marking payout as paid');

  return { data: { ok: true } };
});
