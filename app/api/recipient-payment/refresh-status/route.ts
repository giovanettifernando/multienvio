/**
 * POST /api/recipient-payment/refresh-status
 *
 * Atualiza o status de um pagamento consultando o Mercado Pago
 * Endpoint publico - valida pelo transactionId e recebe paymentToken para seguranca
 * Usado para polling do status do PIX na pagina de pagamento do destinatario
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago';

const refreshSchema = z.object({
  transactionId: z.string().min(1, 'ID da transacao e obrigatorio'),
  paymentToken: z.string().min(1, 'Token de pagamento e obrigatorio'),
});

type RefreshStatusResponse = {
  payment: {
    id: string;
    status: string;
    paidAt: string | null;
    updated: boolean;
  };
};

export const POST = withApiHandler<RefreshStatusResponse>(async (context) => {
  const { logger } = context;

  // Validar payload
  const body = await context.req.json();
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados invalidos', parsed.error.flatten());
  }

  const { transactionId, paymentToken } = parsed.data;

  // Buscar a transacao e verificar se pertence a um recipient payment request
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      status: true,
      externalId: true,
      metadata: true,
      paidAt: true,
    },
  });

  if (!payment) {
    throw ApiError.notFound('Pagamento nao encontrado');
  }

  // Verificar se o pagamento pertence ao recipient payment request correto
  const metadata = payment.metadata as Record<string, unknown> | null;
  if (!metadata || metadata.paymentToken !== paymentToken) {
    throw ApiError.forbidden('Token de pagamento invalido');
  }

  // Se ja foi processado, retornar status atual
  if (['PAID', 'CANCELED', 'REFUNDED', 'FAILED', 'CHARGEBACK'].includes(payment.status)) {
    return {
      data: {
        payment: {
          id: payment.id,
          status: payment.status,
          paidAt: payment.paidAt?.toISOString() ?? null,
          updated: false,
        },
      },
    };
  }

  // Verificar se tem ID externo para consultar
  if (!payment.externalId) {
    throw ApiError.badRequest('Pagamento sem ID externo');
  }

  logger.info('recipient_payment_refresh', { externalId: payment.externalId });
  const updatedPayment = await updatePaymentFromMercadoPago(payment.externalId);

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
