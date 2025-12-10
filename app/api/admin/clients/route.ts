import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import type { AdminClient, ClientsResponse } from '@/lib/admin/types';

/**
 * GET /api/admin/clients
 * Lista clientes da plataforma
 *
 * TODO: Implementar integração real com banco de dados (tabela User)
 * Por enquanto retorna lista vazia aguardando implementação
 */
export const GET = withApiHandler<ClientsResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  // Check permission
  if (!session.permissions.includes(AdminPermission.CONTAS)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  // TODO: Implementar consulta real ao banco de dados
  // Por enquanto retorna lista vazia
  const items: AdminClient[] = [];
  const total = 0;

  const response: ClientsResponse = {
    items,
    page,
    pageSize,
    total,
  };

  logger.info('admin_clients_list', { staffId: session.staffId, total });

  return { data: response };
});
