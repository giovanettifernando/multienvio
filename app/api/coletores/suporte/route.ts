export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import {
  listTicketsForAutonomousCollector,
  createTicketForAutonomousCollector,
  type AutonomousCollectorTicketFilters,
} from '@/lib/support/autonomous-collector-service';
import { NewTicketInputSchema, type Status, type Priority } from '@/lib/validation/support';

/**
 * GET /api/coletores/suporte
 * Lista tickets de suporte do coletor autônomo logado
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? undefined;
    const statusParam = searchParams.getAll('status');
    const priorityParam = searchParams.getAll('priority');

    const filters: AutonomousCollectorTicketFilters = {
      query,
      status: statusParam.length > 0 ? (statusParam as Status[]) : undefined,
      priority: priorityParam.length > 0 ? (priorityParam as Priority[]) : undefined,
    };

    const tickets = await listTicketsForAutonomousCollector(session.coletorId, filters);

    return NextResponse.json({ tickets }, { status: 200 });
  } catch (error) {
    console.error('[COLETORES_SUPORTE_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar tickets';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * POST /api/coletores/suporte
 * Cria novo ticket de suporte para o coletor autônomo logado
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();

    // Validar dados de entrada
    const validatedData = NewTicketInputSchema.parse(body);

    // Criar ticket
    const ticket = await createTicketForAutonomousCollector(session.coletorId, validatedData);

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error('[COLETORES_SUPORTE_POST]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: error },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Erro ao criar ticket';
    return NextResponse.json({ message }, { status: 500 });
  }
}
