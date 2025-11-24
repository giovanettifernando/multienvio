/**
 * POST /api/admin/payment-transactions/[id]/force-approve
 *
 * APENAS PARA DESENVOLVIMENTO/TESTES
 * Força a aprovação de um pagamento simulando o comportamento do MP
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import * as walletService from '@/lib/wallet/wallet.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;

    // Buscar transaction
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      );
    }

    if (transaction.status === 'PAID') {
      return NextResponse.json(
        { error: 'Pagamento já está aprovado' },
        { status: 400 }
      );
    }

    // Atualizar para PAID
    const updated = await prisma.paymentTransaction.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        authorizedAt: new Date(),
      },
    });

    console.log('[ADMIN_FORCE_APPROVE] Pagamento aprovado manualmente:', id);

    // Aplicar efeitos de domínio se for wallet_topup
    const metadata = updated.metadata as Record<string, unknown> | null;

    if (metadata?.type === 'wallet_topup' && updated.userId) {
      await walletService.creditWallet({
        userId: updated.userId,
        amountCents: updated.amountCents,
        description: `Recarga via ${updated.method}`,
        paymentTransactionId: updated.id,
        currency: (metadata.currency as string) || 'BRL',
        providerPaymentId: updated.externalId || undefined,
      });

      console.log('[ADMIN_FORCE_APPROVE] Carteira creditada:', {
        userId: updated.userId,
        amount: updated.amountCents / 100,
      });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: updated.id,
        status: updated.status,
        amountCents: updated.amountCents,
        paidAt: updated.paidAt,
      },
    });
  } catch (error) {
    console.error('[ADMIN_FORCE_APPROVE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao aprovar pagamento';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
