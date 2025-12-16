/**
 * GET /api/recipient-payment/[token]
 *
 * Busca dados publicos de uma solicitacao pelo token de pagamento
 * Endpoint publico - usado pela pagina de pagamento do destinatario
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getRequestByToken } from '@/lib/recipient-payment/service';
import type { PublicPaymentData } from '@/lib/recipient-payment/types';

type GetResponse = PublicPaymentData;

export const GET = withApiHandler<GetResponse>(async (context) => {
  const token = context.params?.token;

  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Token invalido');
  }

  const request = await getRequestByToken(token);

  if (!request) {
    throw ApiError.notFound('Solicitacao nao encontrada');
  }

  // Verificar se expirou
  if (request.status === 'PENDING' && new Date() > request.expiresAt) {
    return {
      data: {
        ...request,
        status: 'EXPIRED' as const,
      },
    };
  }

  return { data: request };
});
