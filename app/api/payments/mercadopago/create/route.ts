/**
 * POST /api/payments/mercadopago/create
 *
 * Cria um pagamento via Mercado Pago
 * Usado pelo frontend (Payment Brick / Checkout API)
 */


import { NextResponse } from 'next/server';
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

/**
 * POST - Cria um pagamento
 */
export async function POST(request: Request) {
  try {
    // Autenticação
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Validar payload
    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          success: false,
          message: userMessage,
          statusDetail: result.paymentData.status_detail,
        },
        { status: 400 }
      );
    }

    // Retornar resposta
    return NextResponse.json(
      {
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
      { status: 201 }
    );
  } catch (error) {
    console.error('[PAYMENTS_MERCADOPAGO_CREATE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar pagamento';
    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
