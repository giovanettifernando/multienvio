import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { getTicketForUser } from '@/modules/support/application/service';
import type { SupportTicket } from '@/shared/validation/support';


export const GET = withApiHandler<SupportTicket, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const ticketId = context.params.id;
  if (!ticketId) {
    throw new ApiError({ code: 'validation_error', message: 'Ticket inválido', status: 400 });
  }

  const ticket = await getTicketForUser(session.userId, ticketId);
  if (!ticket) {
    throw new ApiError({ code: 'not_found', message: 'Ticket não encontrado', status: 404 });
  }

  return { data: ticket };
});
