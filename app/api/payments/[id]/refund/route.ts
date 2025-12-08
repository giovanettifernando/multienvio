/**
 * POST /api/payments/[id]/refund
 *
 * Reembolsa um pagamento (total ou parcial)
 *
 * Body:
 * - amount (opcional): Valor a reembolsar. Se não informado, reembolso total.
 * - reason (opcional): Motivo do reembolso.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { refundPayment, getPaymentById, mapMercadoPagoStatus } from '@/lib/mercadopago';

const refundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Autenticação
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    // Buscar transação no banco
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: { gateway: true },
    });

    if (!transaction) {
      return NextResponse.json({ message: 'Transação não encontrada' }, { status: 404 });
    }

    // Verificar se é do Mercado Pago
    if (transaction.gateway?.slug !== 'mercadopago') {
      return NextResponse.json(
        { message: 'Reembolso disponível apenas para pagamentos Mercado Pago' },
        { status: 400 }
      );
    }

    // Verificar se o pagamento pode ser reembolsado
    if (!['PAID', 'AUTHORIZED'].includes(transaction.status)) {
      return NextResponse.json(
        { message: `Não é possível reembolsar pagamento com status: ${transaction.status}` },
        { status: 400 }
      );
    }

    // Verificar permissão (apenas admin ou dono do pagamento)
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';
    const isOwner = transaction.userId === session.userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ message: 'Sem permissão para reembolsar' }, { status: 403 });
    }

    // Validar body
    const body = await request.json().catch(() => ({}));
    const parsed = refundSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, reason } = parsed.data;

    // Calcular valor já reembolsado (armazenado em metadata)
    const metadata = transaction.metadata as { refundedCents?: number } | null;
    const alreadyRefundedCents = metadata?.refundedCents || 0;

    // Verificar valor do reembolso
    if (amount) {
      const maxRefundCents = transaction.amountCents - alreadyRefundedCents;
      const refundCents = Math.round(amount * 100);

      if (refundCents > maxRefundCents) {
        return NextResponse.json(
          {
            message: `Valor máximo para reembolso: R$ ${(maxRefundCents / 100).toFixed(2)}`,
          },
          { status: 400 }
        );
      }
    }

    // Executar reembolso no Mercado Pago
    const externalId = transaction.externalId;
    if (!externalId) {
      return NextResponse.json(
        { message: 'ID do pagamento no Mercado Pago não encontrado' },
        { status: 400 }
      );
    }

    const refundResult = await refundPayment(externalId, amount);

    // Buscar status atualizado do pagamento
    const updatedPayment = await getPaymentById(externalId);
    const newStatus = mapMercadoPagoStatus(updatedPayment.status);

    // Calcular valor reembolsado em centavos
    const refundedCents = Math.round(refundResult.amount * 100);

    // Calcular novo total reembolsado
    const totalRefundedCents = alreadyRefundedCents + refundedCents;

    // Atualizar transação no banco
    await prisma.paymentTransaction.update({
      where: { id },
      data: {
        status: newStatus,
        metadata: {
          ...(transaction.metadata as object || {}),
          refundedCents: totalRefundedCents,
          lastRefund: {
            id: refundResult.id,
            amount: refundResult.amount,
            reason,
            at: new Date().toISOString(),
            by: session.userId,
          },
        },
      },
    });

    console.log('[REFUND] Reembolso processado:', {
      transactionId: id,
      refundId: refundResult.id,
      amount: refundResult.amount,
      status: refundResult.status,
    });

    return NextResponse.json({
      success: true,
      refund: {
        id: refundResult.id,
        amount: refundResult.amount,
        status: refundResult.status,
      },
      transaction: {
        id,
        status: newStatus,
        refundedCents: totalRefundedCents,
      },
    });
  } catch (error) {
    console.error('[REFUND_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar reembolso';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
