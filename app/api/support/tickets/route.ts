import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { createTicketForUser, listTicketsForUser } from '@/modules/support/application/service';
import {
  NewTicketInputSchema,
  type NewTicketInput,
  type Priority,
  type Status,
  type SupportTicket,
} from '@/shared/validation/support';
import { logger } from '@/platform/logging/logger';

interface ListTicketsResponse {
  tickets: SupportTicket[];
  total: number;
}


function parseArrayParam(params: URLSearchParams, key: string): string[] {
  const values = params.getAll(key);
  if (!values.length) {
    const single = params.get(key);
    if (!single) return [];
    values.push(single);
  }
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export const GET = withApiHandler<ListTicketsResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const url = new URL(context.req.url);
  const params = url.searchParams;

  const statusValues = parseArrayParam(params, 'status') as Status[];
  const priorityValues = parseArrayParam(params, 'priority') as Priority[];
  const query = params.get('q') ?? undefined;
  const limitParam = params.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const allTickets = await listTicketsForUser(session.userId, {
    status: statusValues.length ? statusValues : undefined,
    priority: priorityValues.length ? priorityValues : undefined,
    query,
  });

  const total = allTickets.length;

  // Aplicar limit se fornecido
  const tickets = limit && limit > 0 ? allTickets.slice(0, limit) : allTickets;

  return { data: { tickets, total } };
});

export const POST = withApiHandler<SupportTicket>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const payload = (await context.req.json()) as unknown;
  const parsed = NewTicketInputSchema.safeParse(payload);

  if (!parsed.success) {
    logger.debug({ event: 'ticket_validation_error', errors: parsed.error.flatten() }, 'Ticket validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: parsed.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: NewTicketInput = parsed.data;
  const ticket = await createTicketForUser(session.userId, data);

  logger.info({ event: 'ticket_created', ticketId: ticket.id, userId: session.userId }, 'Support ticket created');

  return { data: ticket, status: 201 };
});
