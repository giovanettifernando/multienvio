/**
 * GET /api/pickup-points
 *
 * Lista pontos de coleta ativos filtrados por localização
 * CACHE: 1 hora - dados de pontos mudam raramente
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import {
  listPickupPoints,
  type PickupPoint,
} from '@/modules/pickup-points/application';

type PickupPointsListResponse = PickupPoint[];

export const GET = withApiHandler<PickupPointsListResponse>(async (context) => {
  // SECURITY F-08: Verificar autenticação (defesa em profundidade)
  const session = await getUserFromRequest(context.req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Autenticação necessária',
      status: 401,
    });
  }

  const { searchParams } = new URL(context.req.url);
  const cidade = searchParams.get('cidade') ?? undefined;
  const uf = searchParams.get('uf') ?? undefined;
  const q = searchParams.get('q') ?? undefined;

  const result = await listPickupPoints({ cidade, uf, q });

  return { data: result };
});
