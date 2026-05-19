/**
 * POST /api/admin/payment-transactions/sync
 *
 * Sincroniza um pagamento específico com o Pagar.me
 */

import { AdminPermission } from '@prisma/client';
import { requireAdminSession } from '@/platform/auth/require-session';
import { updatePaymentFromPagarme } from '@/platform/integrations/pagarme';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

export const POST = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);


  // Obter externalId do body
  const body = await req.json();
  const { externalId } = body;

  if (!externalId) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'externalId é obrigatório',
      status: 400,
    });
  }

  // Sincronizar com Pagar.me
  const transaction = await updatePaymentFromPagarme(externalId);

  return {
    data: {
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        externalId: transaction.externalId,
        amountCents: transaction.amountCents,
      },
    },
  };
});
