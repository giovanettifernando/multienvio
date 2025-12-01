
import { NextResponse } from 'next/server';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { getTicketForCollector } from '@/lib/support/collector-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCollectorSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const ticket = await getTicketForCollector(id, session.pointId);

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('[COLLECTOR_TICKET_GET]', error);
    return NextResponse.json({ message: 'Erro ao buscar ticket' }, { status: 500 });
  }
}
