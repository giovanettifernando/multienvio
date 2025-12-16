/**
 * GET /api/recipient-payment/list
 *
 * Lista as solicitacoes de pagamento do remetente
 * Requer autenticacao
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getSession } from '@/lib/auth/session';
import { listRecipientPaymentRequests } from '@/lib/recipient-payment/service';
import { listRequestsSchema } from '@/lib/recipient-payment/validation';
import type { ListRequestsResult } from '@/lib/recipient-payment/types';

type ListResponse = ListRequestsResult;

export const GET = withApiHandler<ListResponse>(async (context) => {
  // Autenticacao
  const session = await getSession();
  if (!session) {
    throw ApiError.unauthorized('Nao autenticado');
  }

  // Pegar query params
  const url = new URL(context.req.url);
  const status = url.searchParams.get('status') as 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | null;
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');

  // Validar
  const parsed = listRequestsSchema.safeParse({
    status: status || undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  if (!parsed.success) {
    throw ApiError.validation('Parametros invalidos', parsed.error.flatten());
  }

  // Buscar requests
  const result = await listRecipientPaymentRequests(session.userId, parsed.data);

  return { data: result };
});
