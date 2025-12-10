/**
 * POST /api/payments/mercadopago/create
 *
 * Cria um pagamento via Mercado Pago
 * Usado pelo frontend (Payment Brick / Checkout API)
 */


import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createPaymentWithTracking, getStatusDetailMessage } from '@/lib/mercadopago';
import type { CreatePaymentInput } from '@/lib/mercadopago';

/**
 * Schema de validação para criação de pagamento
 */
const createPaymentSchema = z.object({
  // Dados do pagamento
  transactionAmount: z.number().positive('Valor deve ser positivo'),
  token: z.string().optional(), // Token do cartão (opcional para PIX/Boleto)
  paymentMethodId: z.string().min(1, 'Método de pagamento é obrigatório'),
  installments: z.number().int().min(1).max(24).optional(),

  // Dados do pagador
  payer: z.object({
    email: z.string().email('Email inválido'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    identification: z
      .object({
        type: z.string(),
        number: z.string(),
      })
      .optional(),
  }),

  // Descrição
  description: z.string().optional(),

  // Dados do cartão (se aplicável)
  cardData: z
    .object({
      cardholderName: z.string(),
    })
    .optional(),

  // Metadata interna
  metadata: z
    .object({
      type: z.enum(['wallet_topup', 'checkout_payment']),
      walletId: z.string().optional(),
      shipmentId: z.string().optional(),
    })
    .optional(),

  // Device fingerprint para antifraude
  deviceSessionId: z.string().optional(),

  // Tempo de expiração em minutos (para PIX)
  expirationMinutes: z.number().int().min(5).max(1440).optional(), // 5 min a 24h
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

/**
 * POST - Cria um pagamento
 */
export const POST = withApiHandler<PaymentResponse>(async (context) => {
  // Autenticação
  const session = await getSession();
  if (!session) {
    throw ApiError.unauthorized('Não autenticado');
  }

  // Validar payload
  const body = await context.req.json();
  const parsed = createPaymentSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados inválidos', parsed.error.flatten());
  }

  const data = parsed.data;

  // Adicionar userId no metadata
  const paymentInput: CreatePaymentInput = {
    ...data,
    metadata: data.metadata
      ? {
          ...data.metadata,
          userId: session.userId,
        }
      : {
          type: 'wallet_topup', // default
          userId: session.userId,
        },
  };

  // Criar pagamento
  const result = await createPaymentWithTracking(paymentInput);

  // Se pagamento foi rejeitado, retornar erro com mensagem amigável
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
