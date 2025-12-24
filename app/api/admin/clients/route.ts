import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import type { AdminClient, ClientsResponse } from '@/modules/admin/application/types';

/**
 * GET /api/admin/clients
 * Lista clientes da plataforma
 *
 * TODO: Implementar integração real com banco de dados (tabela User)
 * Por enquanto retorna lista vazia aguardando implementação
 */
export const GET = withApiHandler<ClientsResponse>(async (context) => {
  const { req, logger } = context;

  const session = await requireAdminSession(req, AdminPermission.CONTAS);

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
