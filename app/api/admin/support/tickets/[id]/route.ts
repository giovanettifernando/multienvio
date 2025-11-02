import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { getTicket } from '@/lib/support/service';

export const dynamic = 'force-dynamic';

export async function GET(
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
    const ticket = await getTicket(ticketId);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }
    return NextResponse.json(ticket);
  } catch (error) {
    console.error('[ADMIN_SUPPORT_TICKET_GET]', error);
    return NextResponse.json({ message: 'Erro ao carregar ticket' }, { status: 500 });
  }
}
