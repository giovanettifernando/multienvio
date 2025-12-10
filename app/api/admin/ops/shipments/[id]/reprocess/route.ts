import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/lib/logger';

interface ReprocessResponse {
  ok: boolean;
}

export const POST = withApiHandler<ReprocessResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = await params;
  // TODO: Implementar reprocessamento real
  logger.debug({ event: 'reprocess_shipment', id }, 'Reprocessing shipment');

  return { data: { ok: true } };
});
