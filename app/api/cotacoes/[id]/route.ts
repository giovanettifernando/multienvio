
import { NextResponse } from 'next/server';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { getQuoteDetail, cancelQuote } from '@/lib/quotes/service';

/**
 * GET /api/cotacoes/[id]
 * Gets detailed information about a specific quote
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const quote = await getQuoteDetail(session.userId, id);

    if (!quote) {
      return NextResponse.json({ message: 'Cotação não encontrada' }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error('[COTACOES_GET_DETAIL]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar cotação';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * DELETE /api/cotacoes/[id]
 * Cancels a quote
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;
    await cancelQuote(session.userId, id);

    return NextResponse.json({ message: 'Cotação cancelada com sucesso' });
  } catch (error) {
    console.error('[COTACOES_DELETE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao cancelar cotação';
    return NextResponse.json({ message }, { status: 500 });
  }
}
