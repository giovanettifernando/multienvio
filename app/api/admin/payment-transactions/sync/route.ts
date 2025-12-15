/**
 * POST /api/admin/payment-transactions/sync
 *
 * Sincroniza um pagamento específico com o Mercado Pago
 */

import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago/payments';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

export const POST = withApiHandler(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

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

  // Sincronizar com Mercado Pago
  const transaction = await updatePaymentFromMercadoPago(externalId);

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
