/**
 * POST /api/admin/payment-transactions/sync
 *
 * Sincroniza um pagamento específico com o Asaas
 */

import { AdminPermission } from '@prisma/client';
import { requireAdminSession } from '@/platform/auth/require-session';
import { getCharge, mapAsaasStatus } from '@/platform/integrations/asaas';
import { prisma } from '@/platform/db/db';
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

  // Sincronizar com o Asaas
  const existing = await prisma.paymentTransaction.findFirst({
    where: { externalId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'not_found',
      message: 'Transação não encontrada para este externalId',
      status: 404,
    });
  }

  const charge = await getCharge(externalId);
  const status = mapAsaasStatus(charge.status);

  const transaction = await prisma.paymentTransaction.update({
    where: { id: existing.id },
    data: {
      status,
      paidAt: status === 'PAID' ? new Date() : undefined,
      authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
    },
  });

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
