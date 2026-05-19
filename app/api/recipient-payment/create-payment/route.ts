/**
 * POST /api/recipient-payment/create-payment
 *
 * Cria um pagamento via Pagar.me para destinatario
 * Endpoint publico - valida pelo paymentToken do request
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { createPagarmePaymentWithTracking } from '@/platform/integrations/pagarme';

const createPaymentSchema = z.object({
  paymentToken: z.string().min(1, 'Token de pagamento e obrigatorio'),
  transactionAmount: z.number().positive('Valor deve ser positivo'),
  paymentMethod: z.enum(['credit_card', 'pix']),
  cardToken: z.string().optional(), // Token do cartao via Tokenizecard.js
  cardId: z.string().optional(),    // ID de cartao salvo
  installments: z.number().int().min(1).max(24).optional(),
  description: z.string().optional(),
});

type PaymentResponse = {
  success: boolean;
  transaction: {
    id: string;
    referenceId: string;
    status: string;
    amountCents: number;
    method: string;
  };
  payment: {
    id: string;
    status: string;
    pixQrCode?: string;
    pixQrCodeUrl?: string;
  };
};

export const POST = withApiHandler<PaymentResponse>(async (context) => {
  // Validar payload
  const body = await context.req.json();
  const parsed = createPaymentSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados invalidos', parsed.error.flatten());
  }

  const { paymentToken, ...paymentData } = parsed.data;

  // Buscar request diretamente para ter acesso ao senderId
  const request = await prisma.recipientPaymentRequest.findUnique({
    where: { paymentToken },
    select: {
      id: true,
      senderId: true,
      status: true,
      expiresAt: true,
      totalCents: true,
      carrier: true,
      service: true,
    },
  });

  if (!request) {
    throw ApiError.notFound('Solicitacao de pagamento nao encontrada');
  }

  // Verificar status
  if (request.status === 'PAID') {
    throw ApiError.badRequest('Esta solicitacao ja foi paga');
  }

  if (request.status === 'CANCELLED') {
    throw ApiError.badRequest('Esta solicitacao foi cancelada');
  }

  if (request.status === 'EXPIRED' || new Date() > request.expiresAt) {
    throw ApiError.badRequest('Esta solicitacao expirou');
  }

  // Verificar que o valor corresponde
  const expectedAmount = request.totalCents / 100;
  if (Math.abs(paymentData.transactionAmount - expectedAmount) > 0.01) {
    throw ApiError.badRequest('Valor do pagamento nao corresponde ao esperado');
  }

  // Buscar dados do remetente para criacao do cliente no Pagar.me
  const sender = await prisma.user.findUniqueOrThrow({
    where: { id: request.senderId },
    select: { id: true, name: true, email: true, cpf: true, cnpj: true, phone: true },
  });

  // Criar pagamento no Pagar.me
  const result = await createPagarmePaymentWithTracking({
    userId: sender.id,
    userName: sender.name,
    userEmail: sender.email,
    userDocument: sender.cpf?.replace(/\D/g, '') ?? sender.cnpj?.replace(/\D/g, '') ?? undefined,
    userPhone: sender.phone ?? undefined,
    amountCents: request.totalCents,
    description: paymentData.description || `Frete - ${request.carrier} - ${request.service}`,
    referenceId: `pm_${Date.now()}`,
    paymentMethod: paymentData.paymentMethod,
    cardToken: paymentData.cardToken,
    cardId: paymentData.cardId,
    installments: paymentData.installments,
    metadata: {
      type: 'checkout_payment' as const,
      userId: request.senderId,
      recipientPaymentRequestId: request.id,
      paymentToken,
      isRecipientPayment: 'true',
    },
  });

  // Se pagamento foi rejeitado (cartao nao autorizado), retornar erro amigavel
  if (result.status === 'FAILED') {
    throw ApiError.badRequest('Cartao nao autorizado. Verifique os dados e tente novamente.');
  }

  // Retornar resposta
  return {
    data: {
      success: true,
      transaction: {
        id: result.transaction.id,
        referenceId: result.transaction.referenceId,
        status: result.transaction.status,
        amountCents: result.transaction.amountCents,
        method: result.transaction.method,
      },
      payment: {
        id: result.orderId,
        status: result.status,
        pixQrCode: result.pixQrCode,
        pixQrCodeUrl: result.pixQrCodeUrl,
      },
    },
    status: 201,
  };
});
