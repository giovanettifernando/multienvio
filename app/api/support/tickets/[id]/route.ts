import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { getTicketForUser } from '@/lib/support/service';
import type { SupportTicket } from '@/lib/validation/support';


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
