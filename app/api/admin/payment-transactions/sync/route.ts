/**
 * POST /api/admin/payment-transactions/sync
 *
 * Sincroniza um pagamento específico com o Asaas
 */

import { AdminPermission } from '@prisma/client';
import { requireAdminSession } from '@/platform/auth/require-session';
import { updatePaymentFromAsaas } from '@/platform/integrations/asaas/tracking';
import * as walletService from '@/modules/wallet/application/wallet.service';
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

  // Mesmo caminho do webhook: atualiza pela cobrança do Asaas e, se for uma
  // recarga liberada, credita a carteira (idempotente). O monitor de PIX só
  // olha cobranças PENDING, então marcar PAID aqui sem creditar deixava a
  // recarga paga sem virar saldo.
  await updatePaymentFromAsaas(externalId);
  await walletService.creditTopupIfReleased(existing.id);

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: existing.id },
  });
  if (!transaction) {
    throw new ApiError({ code: 'not_found', message: 'Transação não encontrada', status: 404 });
  }

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
