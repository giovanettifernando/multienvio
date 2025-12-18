import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getCollectorSessionFromRequest } from '@/modules/auth/application/collector-session';
import { getTicketForCollector } from '@/modules/support/application/collector-service';
import type { SupportTicket } from '@/shared/validation/support';

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
