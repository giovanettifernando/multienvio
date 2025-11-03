export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { selectQuoteOption } from '@/lib/quotes/service';
import {
  quoteSelectionSchema,
  type QuoteSelectionRequest,
} from '@/lib/validation/quote-backend';

/**
 * POST /api/cotacoes/selecionar
 * Selects a shipping option for a quote
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Parse and validate request body
    const body = (await request.json()) as unknown;
    const parsed = quoteSelectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: QuoteSelectionRequest = parsed.data;

    // Select option
    const result = await selectQuoteOption(session.userId, data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[COTACOES_SELECIONAR_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao selecionar opção';
    return NextResponse.json({ message }, { status: 500 });
  }
}
