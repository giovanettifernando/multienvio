import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/platform/logging/logger';

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
