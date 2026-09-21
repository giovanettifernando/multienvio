/**
 * POST /api/admin/payment-transactions/[id]/refund
 *
 * Reembolsa um pagamento (total ou parcial). Só staff do financeiro: o estorno
 * não desfaz a recarga nem os envios pagos, então liberado ao próprio cliente
 * permitia gastar o saldo e depois estornar o cartão.
 *
 * Body:
 * - amount (opcional): Valor a reembolsar. Se não informado, reembolso total.
 * - reason (opcional): Motivo do reembolso.
 */

import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, type TransactionStatus } from '@prisma/client';
import { refundCharge } from '@/platform/integrations/asaas/charges';
import { mapAsaasStatus } from '@/platform/integrations/asaas/status';
import { isRefundableTransactionStatus } from '@/shared/utils/payment-status';

const refundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

type RefundPaymentResponse = {
  success: boolean;
  refund: {
    id: number;
    amount: number;
    status: string;
  };
  transaction: {
    id: string;
    status: string;
    refundedCents: number;
  };
};

export const POST = withApiHandler<RefundPaymentResponse, { id: string }>(async (context) => {
  const { logger } = context;
  const session = await requireAdminSession(context.req, AdminPermission.FINANCEIRO);

  const { id } = await context.params;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
    include: { gateway: true },
  });

  if (!transaction) {
    throw new ApiError({ code: 'not_found', message: 'Transação não encontrada', status: 404 });
  }

  const slug = transaction.gateway?.slug;
  if (slug !== 'asaas') {
    throw new ApiError({
      code: 'validation_error',
      message: 'Reembolso disponível apenas para pagamentos via cartão ou PIX',
      status: 400,
    });
  }

  if (!isRefundableTransactionStatus(transaction.status)) {
    throw new ApiError({
      code: 'validation_error',
      message: `Não é possível reembolsar pagamento com status: ${transaction.status}`,
      status: 400,
    });
  }

  let body: unknown = {};
  try {
    body = await context.req.json();
  } catch {
    // Empty body is valid
  }

  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { amount, reason } = parsed.data;

  const metadata = transaction.metadata as { refundedCents?: number } | null;
  const alreadyRefundedCents = metadata?.refundedCents || 0;

  if (amount) {
    const maxRefundCents = transaction.amountCents - alreadyRefundedCents;
    const refundCents = Math.round(amount * 100);

    if (refundCents > maxRefundCents) {
      throw new ApiError({
        code: 'validation_error',
        message: `Valor máximo para reembolso: R$ ${(maxRefundCents / 100).toFixed(2)}`,
        status: 400,
      });
    }
  }

  const externalId = transaction.externalId;
  if (!externalId) {
    throw new ApiError({
      code: 'validation_error',
      message: 'ID do pagamento não encontrado',
      status: 400,
    });
  }

  let newStatus: TransactionStatus;
  let refundedCents: number;
  let refundId: string | number;
  let refundStatus: string;
  let refundAmount: number;

  // O Asaas estorna pela própria cobrança (payment_transactions.externalId) —
  // não existe um "chargeId" separado como no Pagar.me.
  const amountCents = amount ? Math.round(amount * 100) : undefined;
  const charge = await refundCharge(externalId, amountCents);
  newStatus = mapAsaasStatus(charge.status);
  refundedCents = amountCents ?? transaction.amountCents;
  refundId = externalId;
  refundStatus = 'refunded';
  refundAmount = refundedCents / 100;

  const totalRefundedCents = alreadyRefundedCents + refundedCents;

  await prisma.paymentTransaction.update({
    where: { id },
    data: {
      status: newStatus,
      metadata: {
        ...(transaction.metadata as object || {}),
        refundedCents: totalRefundedCents,
        lastRefund: {
          id: refundId,
          amount: refundAmount,
          reason,
          at: new Date().toISOString(),
          by: session.staffId,
        },
      },
    },
  });

  logger.info('refund_processed', {
    transactionId: id,
    adminId: session.staffId,
    refundId,
    amount: refundAmount,
    status: refundStatus,
  });

  return {
    data: {
      success: true,
      refund: {
        id: typeof refundId === 'string' ? parseInt(refundId, 10) || 0 : refundId,
        amount: refundAmount,
        status: refundStatus,
      },
      transaction: {
        id,
        status: newStatus,
        refundedCents: totalRefundedCents,
      },
    },
  };
});
