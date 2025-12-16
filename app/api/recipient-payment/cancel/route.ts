/**
 * POST /api/recipient-payment/cancel
 *
 * Cancela uma solicitacao de pagamento
 * Requer autenticacao - apenas o remetente pode cancelar
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getSession } from '@/lib/auth/session';
import { cancelRecipientPaymentRequest } from '@/lib/recipient-payment/service';
import { cancelRequestSchema } from '@/lib/recipient-payment/validation';

type CancelResponse = {
  success: boolean;
  message: string;
};

export const POST = withApiHandler<CancelResponse>(async (context) => {
  // Autenticacao
  const session = await getSession();
  if (!session) {
    throw ApiError.unauthorized('Nao autenticado');
  }

  // Validar payload
  const body = await context.req.json();
  const parsed = cancelRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados invalidos', parsed.error.flatten());
  }

  const { requestId } = parsed.data;

  // Cancelar request
  const result = await cancelRecipientPaymentRequest(requestId, session.userId);

  if (!result.success) {
    throw ApiError.badRequest(result.error || 'Erro ao cancelar solicitacao');
  }

  return {
    data: {
      success: true,
      message: 'Solicitacao cancelada com sucesso',
    },
  };
});
