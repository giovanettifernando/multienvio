import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { getTicket } from '@/lib/support/service';


export const GET = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.SUPORTE) && !session.isSuperAdmin) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

  const ticketId = params.id;
  if (!ticketId) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Ticket inválido',
      status: 400,
    });
  }

  // Admin vê mensagens internas
  const ticket = await getTicket(ticketId, true);
  if (!ticket) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Ticket não encontrado',
      status: 404,
    });
  }

  return { data: ticket };
});
