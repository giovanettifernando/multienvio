import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAutonomousCollectorSession } from '@/modules/auth/application/autonomous-collector-session';
import {
  listCollectorPickups,
  type CollectorPickupsResponse,
} from '@/modules/coletores/application';

/**
 * GET /api/coletores/coletas
 * Lista pickup requests pendentes atribuídas ao coletor logado
 */
export const GET = withApiHandler<CollectorPickupsResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    logger.debug('coletores_coletas_no_session');
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  logger.debug('coletores_coletas_session', { coletorId: session.coletorId });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
  const status = searchParams.get('status') ?? 'PENDING,SCHEDULED';

  const result = await listCollectorPickups(
    session.coletorId,
    { status },
    { page, pageSize }
  );

  return { data: result };
});
