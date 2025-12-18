/**
 * GET /api/shipments
 *
 * Lista shipments do usuário com filtros e paginação
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { listUserShipments, type PaginatedResult, type ShipmentListItem } from '@/modules/shipments/application';

type ShipmentListResponse = PaginatedResult<ShipmentListItem>;

export const GET = withApiHandler<ShipmentListResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const q = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? 'Todos';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  const result = await listUserShipments(
    session.userId,
    { q, status },
    { page, limit }
  );

  return { data: result };
});

// POST /api/shipments foi movido para /api/checkout
// A criação de shipments agora é feita através do fluxo de checkout
