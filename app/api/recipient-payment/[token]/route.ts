/**
 * GET /api/recipient-payment/[token]
 *
 * Busca dados publicos de uma solicitacao pelo token de pagamento
 * Endpoint publico - usado pela pagina de pagamento do destinatario
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getRequestByToken } from '@/modules/recipients/application/service';
import type { PublicPaymentData } from '@/modules/recipients/application/types';

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
