import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAutonomousCollectorSession } from '@/modules/auth/application/autonomous-collector-session';
import {
  listTicketsForAutonomousCollector,
  createTicketForAutonomousCollector,
  type AutonomousCollectorTicketFilters,
} from '@/modules/support/application/autonomous-collector-service';
import { NewTicketInputSchema, type Status, type Priority, type SupportTicket } from '@/shared/validation/support';
import { z } from 'zod';

type SuporteListResponse = {
  tickets: SupportTicket[];
};

type SuporteCreateResponse = {
  ticket: SupportTicket;
};

/**
 * GET /api/coletores/suporte
 * Lista tickets de suporte do coletor autônomo logado
 */
export const GET = withApiHandler<SuporteListResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? undefined;
  const statusParam = searchParams.getAll('status');
  const priorityParam = searchParams.getAll('priority');

  const filters: AutonomousCollectorTicketFilters = {
    query,
    status: statusParam.length > 0 ? (statusParam as Status[]) : undefined,
    priority: priorityParam.length > 0 ? (priorityParam as Priority[]) : undefined,
  };

  const tickets = await listTicketsForAutonomousCollector(session.coletorId, filters);

  logger.info('coletores_suporte_list_success', { coletorId: session.coletorId, count: tickets.length });

  return { data: { tickets } };
});

/**
 * POST /api/coletores/suporte
 * Cria novo ticket de suporte para o coletor autônomo logado
 */
export const POST = withApiHandler<SuporteCreateResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const body = await req.json();

  // Validar dados de entrada
  try {
    const validatedData = NewTicketInputSchema.parse(body);

    // Criar ticket
    const ticket = await createTicketForAutonomousCollector(session.coletorId, validatedData);

    logger.info('coletores_suporte_create_success', { coletorId: session.coletorId, ticketId: ticket.id });

    return { data: { ticket }, status: 201 };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError({
        code: 'validation_error',
        message: 'Dados inválidos',
        status: 400,
        details: { errors: error.issues },
      });
    }
    throw error;
  }
});
