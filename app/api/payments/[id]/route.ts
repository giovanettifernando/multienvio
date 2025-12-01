/**
 * GET /api/payments/[id]
 *
 * Endpoint para consultar status de um pagamento
 * Usado pelo frontend para polling de status de PIX
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';


interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
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

    return NextResponse.json({
      payment: {
        id: payment.id,
        status: payment.status,
        method: payment.method,
        amountCents: payment.amountCents,
        referenceId: payment.referenceId,
        externalId: payment.externalId,
        metadata: payment.metadata,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
      },
    });
  } catch (error) {
    console.error('[PAYMENT_STATUS_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao consultar pagamento' },
      { status: 500 }
    );
  }
}
