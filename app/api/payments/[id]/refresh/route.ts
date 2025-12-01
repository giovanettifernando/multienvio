/**
 * POST /api/payments/[id]/refresh
 *
 * Atualiza o status de um pagamento consultando o Mercado Pago
 * Usado para polling manual ou refresh de status
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago';


interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    // Verificar autenticação
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Buscar pagamento
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
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário é o dono do pagamento
    if (payment.userId && payment.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    // Se não tem externalId, não pode consultar o MP
    if (!payment.externalId) {
      return NextResponse.json(
        { error: 'Pagamento sem ID externo' },
        { status: 400 }
      );
    }

    // Se já está em estado final, não precisa atualizar
    if (['PAID', 'CANCELED', 'REFUNDED', 'FAILED', 'CHARGEBACK'].includes(payment.status)) {
      return NextResponse.json({
        payment: {
          id: payment.id,
          status: payment.status,
          updated: false,
        },
      });
    }

    // Atualizar do Mercado Pago
    console.log('[PAYMENT_REFRESH] Atualizando do MP:', payment.externalId);
    const updatedPayment = await updatePaymentFromMercadoPago(payment.externalId);

    return NextResponse.json({
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        paidAt: updatedPayment.paidAt,
        updated: true,
      },
    });
  } catch (error) {
    console.error('[PAYMENT_REFRESH_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar pagamento' },
      { status: 500 }
    );
  }
}
