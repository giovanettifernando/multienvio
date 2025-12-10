import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { getQuoteDetail, cancelQuote } from '@/lib/quotes/service';

import type { QuoteStatus, DocumentType } from '@prisma/client';

type GetQuoteDetailResponse = {
  id: string;
  userId: string;
  status: QuoteStatus;
  originCep: string;
  destCep: string;
  documentType: DocumentType;
  isReverse: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  selectedAt: string | null;
  nfeValue: number | null;
  volumes: Array<{
    id: string;
    height: number;
    width: number;
    length: number;
    weight: number;
    cubicWeight: number;
  }>;
  options: Array<{
    id: string;
    carrierId: string;
    carrierName: string;
    serviceId: string;
    serviceName: string;
    basePriceCents: number;
    insuranceCents: number;
    additionalCents: number;
    discountCents: number;
    totalCents: number;
    deliveryDays: number;
    metadata: unknown;
  }>;
  selection: {
    id: string;
    optionId: string;
    carrierName: string;
    serviceName: string;
    totalCents: number;
    deliveryDays: number;
    selectedAt: string;
  } | null;
};

type DeleteQuoteResponse = {
  message: string;
};

/**
 * GET /api/cotacoes/[id]
 * Gets detailed information about a specific quote
 */
export const GET = withApiHandler<GetQuoteDetailResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;
  const quote = await getQuoteDetail(session.userId, id);

  if (!quote) {
    throw new ApiError({ code: 'not_found', message: 'Cotação não encontrada', status: 404 });
  }

  const response: GetQuoteDetailResponse = {
    id: quote.id,
    userId: quote.userId,
    status: quote.status,
    originCep: quote.originCep,
    destCep: quote.destCep,
    documentType: quote.documentType,
    isReverse: quote.isReverse,
    nfeValue: quote.nfeValue ? Number(quote.nfeValue) : null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    expiresAt: quote.expiresAt.toISOString(),
    selectedAt: quote.selectedAt ? quote.selectedAt.toISOString() : null,
    volumes: quote.volumes,
    options: quote.options,
    selection: quote.selection
      ? {
          id: quote.selection.id,
          optionId: quote.selection.optionId,
          carrierName: quote.selection.carrierName,
          serviceName: quote.selection.serviceName,
          totalCents: quote.selection.totalCents,
          deliveryDays: quote.selection.deliveryDays,
          selectedAt: quote.selection.selectedAt.toISOString(),
        }
      : null,
  };

  return { data: response };
});

/**
 * DELETE /api/cotacoes/[id]
 * Cancels a quote
 */
export const DELETE = withApiHandler<DeleteQuoteResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;
  await cancelQuote(session.userId, id);

  return {
    data: {
      message: 'Cotação cancelada com sucesso',
    },
  };
});
