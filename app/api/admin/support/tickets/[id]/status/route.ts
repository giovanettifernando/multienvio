import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { updateTicketStatus } from '@/lib/support/service';
import { StatusSchema } from '@/lib/validation/support';

const UpdateStatusSchema = z.object({
  status: StatusSchema,
});


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.SUPORTE);
  if (permissionError) return permissionError;

  const { id: ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ message: 'Ticket inválido' }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as unknown;
    const parsed = UpdateStatusSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const ticket = await updateTicketStatus(ticketId, parsed.data.status);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('[ADMIN_SUPPORT_TICKET_STATUS]', error);
    return NextResponse.json({ message: 'Erro ao atualizar status' }, { status: 500 });
  }
}
