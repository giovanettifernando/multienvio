/**
 * POST /api/recipient-payment/create-payment
 *
 * Cria um pagamento via Mercado Pago para destinatario
 * Endpoint publico - valida pelo paymentToken do request
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { createPaymentWithTracking, getStatusDetailMessage } from '@/platform/integrations/mercadopago';
import type { CreatePaymentInput } from '@/platform/integrations/mercadopago';

const createPaymentSchema = z.object({
  paymentToken: z.string().min(1, 'Token de pagamento e obrigatorio'),
  transactionAmount: z.number().positive('Valor deve ser positivo'),
  token: z.string().optional(), // Token do cartao (para pagamento com cartao)
  paymentMethodId: z.string().min(1, 'Metodo de pagamento e obrigatorio'),
  installments: z.number().int().min(1).max(24).optional(),
  payer: z.object({
    email: z.string().email('Email invalido'),
    identification: z.object({
      type: z.string(),
      number: z.string(),
    }).optional(),
  }),
  description: z.string().optional(),
  cardData: z.object({
    cardholderName: z.string(),
  }).optional(),
  deviceSessionId: z.string().optional(),
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
    id: number;
    status: string;
    statusDetail: string;
    statusMessage: string;
    pixQrCode?: string;
    pixQrCodeBase64?: string;
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

  // Criar pagamento no MercadoPago
  const paymentInput: CreatePaymentInput = {
    transactionAmount: paymentData.transactionAmount,
    token: paymentData.token,
    paymentMethodId: paymentData.paymentMethodId,
    installments: paymentData.installments,
    payer: paymentData.payer,
    description: paymentData.description || `Frete - ${request.carrier} - ${request.service}`,
    cardData: paymentData.cardData,
    deviceSessionId: paymentData.deviceSessionId,
    metadata: {
      type: 'checkout_payment' as const,
      userId: request.senderId, // Usar o ID do remetente para rastreamento
      recipientPaymentRequestId: request.id,
      paymentToken,
      isRecipientPayment: true,
    },
  };

  // Criar pagamento
  const result = await createPaymentWithTracking(paymentInput);

  // Se pagamento foi rejeitado, retornar erro com mensagem amigavel
  if (result.paymentData.status === 'rejected') {
    const userMessage = getStatusDetailMessage(result.paymentData.status_detail);
    throw ApiError.badRequest(userMessage, {
      statusDetail: result.paymentData.status_detail,
    });
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
        id: result.paymentData.id,
        status: result.paymentData.status,
        statusDetail: result.paymentData.status_detail,
        statusMessage: getStatusDetailMessage(result.paymentData.status_detail),
        // PIX data
        pixQrCode: result.paymentData.point_of_interaction?.transaction_data?.qr_code,
        pixQrCodeBase64:
          result.paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
      },
    },
    status: 201,
  };
});
