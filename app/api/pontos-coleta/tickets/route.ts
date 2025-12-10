import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { createTicketForCollector, listTicketsForCollector } from '@/lib/support/collector-service';
import {
  NewTicketInputSchema,
  type NewTicketInput,
  type Priority,
  type Status,
  type SupportTicket,
} from '@/lib/validation/support';

type TicketsListResponse = {
  tickets: SupportTicket[];
};

type TicketCreateResponse = SupportTicket;

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

export const GET = withApiHandler<TicketsListResponse>(async (context) => {
  const session = await getCollectorSessionFromRequest(context.req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const url = new URL(context.req.url);
  const params = url.searchParams;

  const statusValues = parseArrayParam(params, 'status') as Status[];
  const priorityValues = parseArrayParam(params, 'priority') as Priority[];
  const query = params.get('q') ?? undefined;

  const tickets = await listTicketsForCollector(session.pointId, {
    status: statusValues.length ? statusValues : undefined,
    priority: priorityValues.length ? priorityValues : undefined,
    query,
  });

  return { data: { tickets } };
});

export const POST = withApiHandler<TicketCreateResponse>(async (context) => {
  const session = await getCollectorSessionFromRequest(context.req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const payload = (await context.req.json()) as unknown;
  const parsed = NewTicketInputSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: NewTicketInput = parsed.data;
  const ticket = await createTicketForCollector(session.pointId, data);

  return { data: ticket, status: 201 };
});
