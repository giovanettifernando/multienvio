import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission } from '@prisma/client';
import { listTicketsForAdmin } from '@/modules/support/application/service';
import type { Priority, Status } from '@/shared/validation/support';


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

export const GET = withApiHandler(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.SUPORTE) && !session.isSuperAdmin) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

  const url = new URL(req.url);
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

  return { data: result };
});
