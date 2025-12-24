import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { getTicket } from '@/modules/support/application/service';


export const GET = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.SUPORTE);

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
