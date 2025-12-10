import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit-redis';

interface ApproveCommissionResponse {
  ok: boolean;
}

export const POST = withApiHandler<ApproveCommissionResponse, { id: string }>(async ({ req, params }) => {
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

  const rateLimitError = await rateLimitByUser(session.staffId, 'commission_approve', RATE_LIMITS.FINANCE);
  if (rateLimitError) {
    throw new ApiError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      status: 429,
    });
  }

  const { id } = params;
  console.log('[Mock] Approving commission:', id);

  return { data: { ok: true } };
});
