import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { updateTicketStatus } from '@/modules/support/application/service';
import { StatusSchema } from '@/shared/validation/support';

const UpdateStatusSchema = z.object({
  status: StatusSchema,
});


export const PATCH = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.SUPORTE);

  const ticketId = params.id;
  if (!ticketId) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Ticket inválido',
      status: 400,
    });
  }

  const payload = (await req.json()) as unknown;
  const parsed = UpdateStatusSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const ticket = await updateTicketStatus(ticketId, parsed.data.status);
  if (!ticket) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Ticket não encontrado',
      status: 404,
    });
  }

  return { data: ticket };
});
