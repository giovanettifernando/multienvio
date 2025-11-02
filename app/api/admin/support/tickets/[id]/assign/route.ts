import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
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

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const { id: ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ message: 'Ticket inválido' }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as unknown;
    const parsed = AssignSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (parsed.data.assignedTo === undefined) {
      return NextResponse.json({ message: 'Campo assignedTo obrigatório' }, { status: 400 });
    }

    const assignedTo = parsed.data.assignedTo ?? null;

    const ticket = await assignTicket(ticketId, assignedTo ?? null);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('[ADMIN_SUPPORT_TICKET_ASSIGN]', error);
    return NextResponse.json({ message: 'Erro ao atualizar atribuição' }, { status: 500 });
  }
}
