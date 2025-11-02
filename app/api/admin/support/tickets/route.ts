import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { listTicketsForAdmin } from '@/lib/support/service';
import type { Priority, Status } from '@/lib/validation/support';

export const dynamic = 'force-dynamic';

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

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  const statusValues = parseArrayParam(params, 'status') as Status[];
  const priorityValues = parseArrayParam(params, 'priority') as Priority[];
  const query = params.get('q') ?? undefined;
  const requesterEmail = params.get('requesterEmail') ?? undefined;
  const assignedToParam = params.get('assignedTo');
  const assignedTo =
    assignedToParam === 'null' ? null : assignedToParam !== null ? assignedToParam : undefined;

  const page = parseInteger(params.get('page'), 1);
  const pageSize = parseInteger(params.get('pageSize'), 20);

  try {
    const result = await listTicketsForAdmin(
      {
        status: statusValues.length ? statusValues : undefined,
        priority: priorityValues.length ? priorityValues : undefined,
        query,
        requesterEmail,
        assignedTo,
      },
      page,
      pageSize,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ADMIN_SUPPORT_TICKETS_GET]', error);
    return NextResponse.json({ message: 'Erro ao carregar tickets' }, { status: 500 });
  }
}
