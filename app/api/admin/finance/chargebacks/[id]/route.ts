import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit-redis';

const updateChargebackSchema = z.object({
  status: z.enum(['pending', 'won', 'lost', 'cancelled']),
  notes: z.string().optional(),
});

interface UpdateChargebackResponse {
  ok: boolean;
}

export const POST = withApiHandler<UpdateChargebackResponse, { id: string }>(async ({ req, params }) => {
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
  console.log('[Mock] Updating chargeback:', id, 'to', status, { notes });

  return { data: { ok: true } };
});
