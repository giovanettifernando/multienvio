import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { logClientStatusChange } from '@/lib/audit-admin';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { z } from 'zod';

interface AdminClientBlockResponse {
  ok: boolean;
}

const AdminClientBlockSchema = z.object({
  clientId: z.string().min(1, 'ID do cliente é obrigatório'),
  reason: z.string().optional(),
});

export const POST = withApiHandler<AdminClientBlockResponse>(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  // Rate limiting (Redis distribuido)
  const rateLimitError = await rateLimitByUser(session.staffId, 'client_block', RATE_LIMITS.USER_MANAGEMENT);
  if (rateLimitError) {
    throw new ApiError({
      code: 'RATE_LIMITED',
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      status: 429,
    });
  }

  const body = await req.json();

  const parsed = AdminClientBlockSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { clientId, reason } = parsed.data;

  // TODO: Implementar bloqueio real do cliente no banco

  // Audit log
  await logClientStatusChange(session.staffId, clientId, 'block', reason);

  return { data: { ok: true } };
});
