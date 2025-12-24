import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { logger } from '@/platform/logging/logger';

interface MarkInvoicePaidResponse {
  ok: boolean;
}

export const POST = withApiHandler<MarkInvoicePaidResponse, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const rateLimitError = await rateLimitByUser(session.staffId, 'invoice_paid', RATE_LIMITS.FINANCE);
  if (rateLimitError) {
    throw new ApiError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      status: 429,
    });
  }

  const { id } = params;

  // TODO: Implementar atualização real no banco de dados
  logger.debug({ event: 'invoice_paid', id }, 'Marking invoice as paid');

  return { data: { ok: true } };
});
