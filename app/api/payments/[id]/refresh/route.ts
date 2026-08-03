/**
 * POST /api/payments/[id]/refresh
 *
 * Atualiza o status de um pagamento consultando o Asaas
 * Usado para polling manual ou refresh de status
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { updatePaymentFromAsaas } from '@/platform/integrations/asaas';

type RefreshPaymentResponse = {
  payment: {
    id: string;
    status: string;
    paidAt: string | null;
    updated: boolean;
  };
};

export const POST = withApiHandler<RefreshPaymentResponse, { id: string }>(async (context) => {
  const { logger } = context;
  const session = await requireUserSession(context.req);

  const { id } = await context.params;

  const payment = await prisma.paymentTransaction.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      externalId: true,
      userId: true,
    },
  });

  if (!payment) {
    throw new ApiError({ code: 'not_found', message: 'Pagamento não encontrado', status: 404 });
  }

  if (payment.userId && payment.userId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Não autorizado', status: 403 });
  }

  if (!payment.externalId) {
    throw new ApiError({ code: 'validation_error', message: 'Pagamento sem ID externo', status: 400 });
  }

  if (['PAID', 'CANCELED', 'REFUNDED', 'FAILED', 'CHARGEBACK'].includes(payment.status)) {
    return {
      data: {
        payment: {
          id: payment.id,
          status: payment.status,
          paidAt: null,
          updated: false,
        },
      },
    };
  }

  logger.info('payment_refresh', { externalId: payment.externalId });
  // updatePaymentFromAsaas sincroniza a transação pelo externalId e não retorna o
  // registro atualizado (diferente do equivalente Pagar.me) — relemos do banco.
  await updatePaymentFromAsaas(payment.externalId);
  const updatedPayment = await prisma.paymentTransaction.findUniqueOrThrow({
    where: { id: payment.id },
    select: { id: true, status: true, paidAt: true },
  });

  return {
    data: {
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        paidAt: updatedPayment.paidAt?.toISOString() ?? null,
        updated: true,
      },
    },
  };
});
