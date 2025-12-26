import { NextRequest } from 'next/server';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { createQuote, listQuotes } from '@/modules/quotes/application/service';
import {
  quoteRequestSchema,
  listQuotesQuerySchema,
  type QuoteRequest,
} from '@/shared/validation/quote-backend';
import { logger } from '@/platform/logging/logger';
import type { QuoteResultItem, QuoteSummary, PartnerPoint, EligibilityResponse } from '@/shared/types/quote';
import { enforceRateLimitByIP, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';

type PostCotacoesResponse = {
  quoteId: string;
  createdAt: string;
  expiresAt: string;
  results: QuoteResultItem[];
  pontosParceiros?: PartnerPoint[];
  eligibility?: EligibilityResponse;
};

/**
 * POST /api/cotacoes
 * Creates a new quote with shipping options
 */
export const POST = withApiHandler<PostCotacoesResponse>(async (context) => {
  // Rate limiting by IP - 20 req/min (QUOTES preset - users make multiple quotes)
  await enforceRateLimitByIP(context.req as NextRequest, 'create_quote', RATE_LIMITS.QUOTES);

  const session = await requireUserSession(context.req);

  // Parse and validate request body
  const body = (await context.req.json()) as unknown;

  const parsed = quoteRequestSchema.safeParse(body);

  if (!parsed.success) {
    logger.debug({ event: 'quote_validation_error', errors: parsed.error.flatten() }, 'Quote validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: parsed.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: QuoteRequest = parsed.data;

  // Create quote with shipping options
  const result = await createQuote(session.userId, data);

  logger.info({
    event: 'quote_created',
    quoteId: result.quoteId,
    userId: session.userId,
    resultsCount: result.results.length,
  }, 'Quote created successfully');

  // Return response matching frontend contract
  return {
    data: {
      quoteId: result.quoteId,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      results: result.results,
      pontosParceiros: result.pontosParceiros,
      eligibility: result.eligibility,
    },
    status: 201,
  };
});

type GetCotacoesResponse = {
  quotes: Array<{
    id: string;
    status: string;
    originCep: string;
    destCep: string;
    createdAt: string;
    expiresAt: string;
    selectedAt: string | null;
    totalOptions: number;
    selectedOption?: {
      carrierName: string;
      serviceName: string;
      totalCents: number;
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * GET /api/cotacoes
 * Lists user's quotes with pagination and filtering
 */
export const GET = withApiHandler<GetCotacoesResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  // Parse query parameters
  const url = new URL(context.req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = listQuotesQuerySchema.safeParse(params);

  if (!parsed.success) {
    throw new ApiError({
      code: 'validation_error',
      message: parsed.error.issues[0]?.message || 'Parâmetros inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
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

  return {
    data: {
      quotes: result.quotes.map((q) => ({
        id: q.id,
        status: q.status,
        originCep: q.originCep,
        destCep: q.destCep,
        createdAt: q.createdAt.toISOString(),
        expiresAt: q.expiresAt.toISOString(),
        selectedAt: q.selectedAt ? q.selectedAt.toISOString() : null,
        totalOptions: q.totalOptions,
        selectedOption: q.selectedOption,
      })),
      pagination: result.pagination,
    },
  };
});
