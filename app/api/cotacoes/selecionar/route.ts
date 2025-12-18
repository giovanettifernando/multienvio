import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { selectQuoteOption } from '@/modules/quotes/application/service';
import {
  quoteSelectionSchema,
  type QuoteSelectionRequest,
} from '@/shared/validation/quote-backend';
import type { QuoteSelectionResponse } from '@/shared/types/quote';

/**
 * POST /api/cotacoes/selecionar
 * Selects a shipping option for a quote
 */
export const POST = withApiHandler<QuoteSelectionResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const body = (await context.req.json()) as unknown;
  const parsed = quoteSelectionSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: QuoteSelectionRequest = parsed.data;
  const result = await selectQuoteOption(session.userId, data);

  return { data: result };
});
