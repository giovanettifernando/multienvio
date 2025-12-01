import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createTicketForUser, listTicketsForUser } from '@/lib/support/service';
import {
  NewTicketInputSchema,
  type NewTicketInput,
  type Priority,
  type Status,
} from '@/lib/validation/support';


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

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  const statusValues = parseArrayParam(params, 'status') as Status[];
  const priorityValues = parseArrayParam(params, 'priority') as Priority[];
  const query = params.get('q') ?? undefined;
  const limitParam = params.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    const allTickets = await listTicketsForUser(session.userId, {
      status: statusValues.length ? statusValues : undefined,
      priority: priorityValues.length ? priorityValues : undefined,
      query,
    });

    const total = allTickets.length;

    // Aplicar limit se fornecido
    const tickets = limit && limit > 0 ? allTickets.slice(0, limit) : allTickets;

    return NextResponse.json({ tickets, total });
  } catch (error) {
    console.error('[SUPPORT_TICKETS_GET]', error);
    return NextResponse.json({ message: 'Erro ao carregar tickets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as unknown;
    const parsed = NewTicketInputSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const data: NewTicketInput = parsed.data;
    const ticket = await createTicketForUser(session.userId, data);

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('[SUPPORT_TICKETS_POST]', error);
    return NextResponse.json({ message: 'Erro ao criar ticket' }, { status: 500 });
  }
}
