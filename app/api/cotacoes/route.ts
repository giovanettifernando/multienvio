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
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[API][${requestId}] POST /api/cotacoes - Início`);

  try {
    // Authenticate user
    console.log(`[API][${requestId}] Verificando autenticação...`);
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      console.warn(`[API][${requestId}] Não autenticado`);
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }
    console.log(`[API][${requestId}] Usuário autenticado:`, { userId: session.userId });

    // Parse and validate request body
    console.log(`[API][${requestId}] Parseando body...`);
    const body = (await request.json()) as unknown;
    console.log(`[API][${requestId}] Body recebido:`, JSON.stringify(body, null, 2));

    const parsed = quoteRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.error(`[API][${requestId}] Validação falhou:`, parsed.error.flatten());
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: QuoteRequest = parsed.data;
    console.log(`[API][${requestId}] Dados validados com sucesso`);

    // Create quote with shipping options
    console.log(`[API][${requestId}] Chamando createQuote...`);
    const result = await createQuote(session.userId, data);
    console.log(`[API][${requestId}] createQuote retornou:`, {
      quoteId: result.quoteId,
      resultsCount: result.results.length,
      hasPontos: !!result.pontosParceiros,
    });

    // Return response matching frontend contract
    const response = {
      quoteId: result.quoteId,
      results: result.results,
      pontosParceiros: result.pontosParceiros,
    };
    console.log(`[API][${requestId}] Enviando resposta (status 201):`, {
      quoteId: response.quoteId,
      resultsCount: response.results.length,
      firstResult: response.results[0],
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error(`[API][${requestId}] ERRO:`, error);
    console.error(`[API][${requestId}] Stack:`, error instanceof Error ? error.stack : 'N/A');
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
