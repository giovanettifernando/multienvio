/**
 * GET /api/payments/[id]
 *
 * Endpoint para consultar status de um pagamento
 * Usado pelo frontend para polling de status de PIX
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

type PaymentStatusResponse = {
  payment: {
    id: string;
    status: string;
    method: string;
    amountCents: number;
    referenceId: string;
    externalId: string | null;
    metadata: unknown;
    createdAt: string;
    paidAt: string | null;
  };
};

export const GET = withApiHandler<PaymentStatusResponse, { id: string }>(async (context) => {
  const session = await requireUserSession(context.req);

  const { id } = await context.params;

  const payment = await prisma.paymentTransaction.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      method: true,
      amountCents: true,
      referenceId: true,
      externalId: true,
      userId: true,
      metadata: true,
      createdAt: true,
      paidAt: true,
    },
  });

  if (!payment) {
    throw new ApiError({ code: 'not_found', message: 'Pagamento não encontrado', status: 404 });
  }

  if (payment.userId && payment.userId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Não autorizado', status: 403 });
  }

  return {
    data: {
      payment: {
        id: payment.id,
        status: payment.status,
        method: payment.method,
        amountCents: payment.amountCents,
        referenceId: payment.referenceId,
        externalId: payment.externalId,
        metadata: payment.metadata,
        createdAt: payment.createdAt.toISOString(),
        paidAt: payment.paidAt?.toISOString() ?? null,
      },
    },
  };
});
