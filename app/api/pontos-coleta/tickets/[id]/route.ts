import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { getTicketForCollector } from '@/lib/support/collector-service';
import type { SupportTicket } from '@/lib/validation/support';

type TicketDetailResponse = {
  ticket: SupportTicket;
};

export const GET = withApiHandler<TicketDetailResponse, { id: string }>(async ({ req, params }) => {
  const session = await getCollectorSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  const ticket = await getTicketForCollector(params.id, session.pointId);

  if (!ticket) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Ticket não encontrado', status: 404 });
  }

  return { data: { ticket } };
});
