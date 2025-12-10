/**
 * POST /api/payments/[id]/refund
 *
 * Reembolsa um pagamento (total ou parcial)
 *
 * Body:
 * - amount (opcional): Valor a reembolsar. Se não informado, reembolso total.
 * - reason (opcional): Motivo do reembolso.
 */

import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { refundPayment, getPaymentById, mapMercadoPagoStatus } from '@/lib/mercadopago';

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
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { id } = await context.params;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
    include: { gateway: true },
  });

  if (!transaction) {
    throw new ApiError({ code: 'not_found', message: 'Transação não encontrada', status: 404 });
  }

  if (transaction.gateway?.slug !== 'mercadopago') {
    throw new ApiError({
      code: 'validation_error',
      message: 'Reembolso disponível apenas para pagamentos Mercado Pago',
      status: 400,
    });
  }

  if (!['PAID', 'AUTHORIZED'].includes(transaction.status)) {
    throw new ApiError({
      code: 'validation_error',
      message: `Não é possível reembolsar pagamento com status: ${transaction.status}`,
      status: 400,
    });
  }

  const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';
  const isOwner = transaction.userId === session.userId;

  if (!isAdmin && !isOwner) {
    throw new ApiError({ code: 'forbidden', message: 'Sem permissão para reembolsar', status: 403 });
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
      message: 'ID do pagamento no Mercado Pago não encontrado',
      status: 400,
    });
  }

  const refundResult = await refundPayment(externalId, amount);

  const updatedPayment = await getPaymentById(externalId);
  const newStatus = mapMercadoPagoStatus(updatedPayment.status);

  const refundedCents = Math.round(refundResult.amount * 100);
  const totalRefundedCents = alreadyRefundedCents + refundedCents;

  await prisma.paymentTransaction.update({
    where: { id },
    data: {
      status: newStatus,
      metadata: {
        ...(transaction.metadata as object || {}),
        refundedCents: totalRefundedCents,
        lastRefund: {
          id: refundResult.id,
          amount: refundResult.amount,
          reason,
          at: new Date().toISOString(),
          by: session.userId,
        },
      },
    },
  });

  logger.info('refund_processed', {
    transactionId: id,
    refundId: refundResult.id,
    amount: refundResult.amount,
    status: refundResult.status,
  });

  return {
    data: {
      success: true,
      refund: {
        id: refundResult.id,
        amount: refundResult.amount,
        status: refundResult.status,
      },
      transaction: {
        id,
        status: newStatus,
        refundedCents: totalRefundedCents,
      },
    },
  };
});
