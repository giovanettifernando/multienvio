import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { assignTicket } from '@/lib/support/service';

const AssignSchema = z.object({
  assignedTo: z
    .union([
      z.string().trim().min(1, 'Informe o responsável'),
      z.literal('').transform(() => null),
      z.null(),
    ])
    .optional(),
});


export const PATCH = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
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

  const ticketId = params.id;
  if (!ticketId) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Ticket inválido',
      status: 400,
    });
  }

  const payload = (await req.json()) as unknown;
  const parsed = AssignSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  if (parsed.data.assignedTo === undefined) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Campo assignedTo obrigatório',
      status: 400,
    });
  }

  const assignedTo = parsed.data.assignedTo ?? null;

  const ticket = await assignTicket(ticketId, assignedTo ?? null);
  if (!ticket) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Ticket não encontrado',
      status: 404,
    });
  }

  return { data: ticket };
});
