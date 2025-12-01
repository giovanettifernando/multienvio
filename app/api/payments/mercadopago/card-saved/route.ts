/**
 * POST /api/payments/mercadopago/card-saved
 *
 * Cria um pagamento usando um cartão previamente cadastrado
 * O CVV deve ser tokenizado no frontend usando SDK do Mercado Pago
 */


import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { createPaymentWithSavedCard } from '@/lib/mercadopago';
import type { CreatePaymentWithSavedCardInput } from '@/lib/mercadopago';

/**
 * Schema de validação
 */
const paymentWithSavedCardSchema = z.object({
  cardId: z.string().min(1, 'ID do cartão é obrigatório'),
  token: z.string().min(1, 'Token do CVV é obrigatório'), // Token gerado no frontend
  transactionAmount: z.number().positive('Valor deve ser positivo'),
  installments: z.number().int().min(1).max(24).optional(),
  description: z.string().optional(),
  metadata: z
    .object({
      type: z.enum(['wallet_topup', 'checkout_payment']),
      walletId: z.string().optional(),
      shipmentId: z.string().optional(),
    })
    .optional(),
});

/**
 * POST - Cria pagamento com cartão salvo
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
    const parsed = paymentWithSavedCardSchema.safeParse(body);

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

    // Buscar cartão no banco
    const card = await prisma.card.findUnique({
      where: { id: data.cardId },
      include: {
        user: true,
      },
    });

    if (!card) {
      return NextResponse.json({ message: 'Cartão não encontrado' }, { status: 404 });
    }

    // Verificar ownership
    if (card.userId !== session.userId) {
      return NextResponse.json({ message: 'Cartão não pertence ao usuário' }, { status: 403 });
    }

    // Verificar se tem mpCardId
    if (!card.mpCardId) {
      return NextResponse.json(
        {
          message: 'Cartão não está vinculado ao Mercado Pago. Use o formulário de cartão completo.',
        },
        { status: 400 }
      );
    }

    // Verificar se usuário tem mpCustomerId
    if (!card.user.mpCustomerId) {
      return NextResponse.json(
        {
          message: 'Usuário não tem customer no Mercado Pago. Use o formulário de cartão completo.',
        },
        { status: 400 }
      );
    }

    // Mapear brand para paymentMethodId
    const paymentMethodMap: Record<string, string> = {
      VISA: 'visa',
      MASTERCARD: 'master',
      ELO: 'elo',
      AMEX: 'amex',
      HIPERCARD: 'hipercard',
      OTHER: 'master', // fallback
    };

    const paymentMethodId = paymentMethodMap[card.brand] || 'master';

    // Criar payload para Mercado Pago
    const paymentInput: CreatePaymentWithSavedCardInput = {
      customerId: card.user.mpCustomerId,
      token: data.token,
      paymentMethodId,
      transactionAmount: data.transactionAmount,
      installments: data.installments || 1,
      description: data.description || `Recarga de carteira - R$ ${data.transactionAmount.toFixed(2)}`,
      metadata: data.metadata
        ? {
            ...data.metadata,
            userId: session.userId,
          }
        : {
            type: 'wallet_topup',
            userId: session.userId,
          },
      payer: {
        email: card.user.email,
        firstName: card.user.name.split(' ')[0],
        lastName: card.user.name.split(' ').slice(1).join(' ') || card.user.name,
      },
    };

    // Buscar gateway do Mercado Pago
    const gateway = await prisma.paymentGateway.findFirst({
      where: {
        slug: 'mercadopago',
        status: 'ACTIVE',
      },
    });

    if (!gateway) {
      return NextResponse.json(
        { message: 'Gateway Mercado Pago não configurado ou inativo' },
        { status: 503 }
      );
    }

    // Criar pagamento no Mercado Pago
    const mpPayment = await createPaymentWithSavedCard(paymentInput);

    // Criar PaymentTransaction no nosso BD
    const transaction = await prisma.paymentTransaction.create({
      data: {
        gatewayId: gateway.id,
        externalId: String(mpPayment.id),
        referenceId: `mp_saved_${mpPayment.id}`,
        userId: session.userId,
        method: 'CREDIT_CARD',
        status: mapMercadoPagoStatus(mpPayment.status as string),
        amountCents: Math.round(data.transactionAmount * 100),
        feeCents: 0,
        netCents: Math.round(data.transactionAmount * 100),
        metadata: paymentInput.metadata as never,
      },
    });

    console.log('[CARD_SAVED_PAYMENT] Pagamento criado:', {
      transactionId: transaction.id,
      mpPaymentId: mpPayment.id,
      status: mpPayment.status,
      amount: data.transactionAmount,
    });

    // Retornar resposta
    return NextResponse.json(
      {
        success: true,
        transaction: {
          id: transaction.id,
          referenceId: transaction.referenceId,
          status: transaction.status,
          amountCents: transaction.amountCents,
          method: transaction.method,
        },
        payment: {
          id: mpPayment.id,
          status: mpPayment.status,
          statusDetail: mpPayment.status_detail,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CARD_SAVED_PAYMENT]', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar pagamento';
    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * Mapeia status do Mercado Pago para TransactionStatus do Prisma
 */
function mapMercadoPagoStatus(mpStatus: string): 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'PAID' | 'REFUNDED' | 'CHARGEBACK' | 'CANCELED' | 'FAILED' {
  const statusMap: Record<string, 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'PAID' | 'REFUNDED' | 'CHARGEBACK' | 'CANCELED' | 'FAILED'> = {
    'pending': 'PENDING',
    'approved': 'PAID',
    'authorized': 'AUTHORIZED',
    'in_process': 'PENDING',
    'in_mediation': 'PENDING',
    'rejected': 'FAILED',
    'cancelled': 'CANCELED',
    'refunded': 'REFUNDED',
    'charged_back': 'CHARGEBACK',
  };

  return statusMap[mpStatus] || 'PENDING';
}
