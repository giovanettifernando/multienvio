export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { createQuote, listQuotes } from '@/lib/quotes/service';
import {
  quoteRequestSchema,
  listQuotesQuerySchema,
  type QuoteRequest,
} from '@/lib/validation/quote-backend';

/**
 * POST /api/cotacoes
 * Creates a new quote with shipping options
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
    const parsed = quoteRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: QuoteRequest = parsed.data;

    // Create quote with shipping options
    const result = await createQuote(session.userId, data);

    // Return response matching frontend contract
    return NextResponse.json(
      {
        quoteId: result.quoteId,
        results: result.results,
        pontosParceiros: result.pontosParceiros,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[COTACOES_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar cotação';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * GET /api/cotacoes
 * Lists user's quotes with pagination and filtering
 */
export async function GET(request: Request) {
  try {
    // Authenticate user
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = listQuotesQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Parâmetros inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const query = parsed.data;

    // Get quotes
    const result = await listQuotes(session.userId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      sort: query.sort,
      order: query.order,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[COTACOES_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar cotações';
    return NextResponse.json({ message }, { status: 500 });
  }
}
