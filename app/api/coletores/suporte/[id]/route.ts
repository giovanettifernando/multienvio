export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { getTicketForAutonomousCollector } from '@/lib/support/autonomous-collector-service';

/**
 * GET /api/coletores/suporte/[id]
 * Obtém detalhes de um ticket específico do coletor autônomo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    const ticket = await getTicketForAutonomousCollector(id, session.coletorId);

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ticket }, { status: 200 });
  } catch (error) {
    console.error('[COLETORES_SUPORTE_GET_BY_ID]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar ticket';
    return NextResponse.json({ message }, { status: 500 });
  }
}
