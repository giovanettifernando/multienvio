/**
 * POST /api/recipient-payment/cancel
 *
 * Cancela uma solicitacao de pagamento
 * Requer autenticacao - apenas o remetente pode cancelar
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getSession } from '@/modules/auth/application/session';
import { cancelRecipientPaymentRequest } from '@/modules/recipients/application/service';
import { cancelRequestSchema } from '@/modules/recipients/application/validation';

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
