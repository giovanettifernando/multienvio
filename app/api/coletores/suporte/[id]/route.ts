import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAutonomousCollectorSession } from '@/modules/auth/application/autonomous-collector-session';
import { getTicketForAutonomousCollector } from '@/modules/support/application/autonomous-collector-service';
import { type SupportTicket } from '@/shared/validation/support';

type SuporteTicketResponse = {
  ticket: SupportTicket;
};

/**
 * GET /api/coletores/suporte/[id]
 * Obtém detalhes de um ticket específico do coletor autônomo
 */
export const GET = withApiHandler<SuporteTicketResponse, { id: string }>(async (context) => {
  const { params, logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { id } = params;

  const ticket = await getTicketForAutonomousCollector(id, session.coletorId);

  if (!ticket) {
    throw new ApiError({ code: 'not_found', message: 'Ticket não encontrado', status: 404 });
  }

  logger.info('coletores_suporte_get_ticket', { coletorId: session.coletorId, ticketId: id });

  return { data: { ticket } };
});
