import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/platform/logging/logger';

interface ReprocessResponse {
  ok: boolean;
}

export const POST = withApiHandler<ReprocessResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  await requireAdminSession(req, AdminPermission.OPERACOES);

  const { id } = await params;
  // TODO: Implementar reprocessamento real
  logger.debug({ event: 'reprocess_shipment', id }, 'Reprocessing shipment');

  return { data: { ok: true } };
});
