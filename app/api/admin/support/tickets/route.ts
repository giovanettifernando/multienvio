import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { parseArrayParam, parsePositiveInteger } from '@/platform/api/params';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { listTicketsForAdmin } from '@/modules/support/application/service';
import type { Priority, Status } from '@/shared/validation/support';

export const GET = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.SUPORTE);

  const url = new URL(req.url);
  const params = url.searchParams;

  const statusValues = parseArrayParam(params, 'status') as Status[];
  const priorityValues = parseArrayParam(params, 'priority') as Priority[];
  const query = params.get('q') ?? undefined;
  const requesterEmail = params.get('requesterEmail') ?? undefined;
  const assignedToParam = params.get('assignedTo');
  const assignedTo =
    assignedToParam === 'null' ? null : assignedToParam !== null ? assignedToParam : undefined;

  const page = parsePositiveInteger(params.get('page'), 1);
  const pageSize = parsePositiveInteger(params.get('pageSize'), 20);

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
