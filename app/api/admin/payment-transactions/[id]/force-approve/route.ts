/**
 * POST /api/admin/payment-transactions/[id]/force-approve
 *
 * ⚠️ AÇÃO ADMINISTRATIVA DE ALTO RISCO
 * Força a aprovação de um pagamento - requer SUPER_ADMIN ou FINANCEIRO
 * Todas as ações são registradas no ledger para auditoria
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import * as walletService from '@/lib/wallet/wallet.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 🛡️ SECURITY FIX: Capturar informações do admin para audit trail
    const adminSession = await getAdminSessionFromRequest(req);
    if (!adminSession) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const { id } = await params;

    // Obter motivo da requisição (opcional mas recomendado)
    let reason = 'Aprovação manual administrativa';
    try {
      const body = await req.json();
      if (body.reason) {
        reason = String(body.reason).substring(0, 500); // Limitar tamanho
      }
    } catch {
      // Body vazio é aceitável
    }

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

    const now = new Date();

    // 🔒 AUDIT TRAIL: Usar transação para garantir que tudo é registrado
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar para PAID
      const updated = await tx.paymentTransaction.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: now,
          authorizedAt: now,
          metadata: {
            ...(transaction.metadata as Record<string, unknown> || {}),
            forceApproved: true,
            forceApprovedAt: now.toISOString(),
            forceApprovedBy: adminSession.staffId,
            forceApprovedByEmail: adminSession.email,
            forceApprovalReason: reason,
          },
        },
      });

      // 🛡️ AUDIT: Criar entrada no ledger para auditoria completa
      // Usando ADJUSTMENT pois FORCE_APPROVAL não existe no enum LedgerEntryType
      await tx.ledgerEntry.create({
        data: {
          type: 'ADJUSTMENT',
          amountCents: updated.amountCents,
          accountType: 'PAYMENT',
          accountId: updated.id,
          description: `Aprovação forçada: ${reason}`,
          metadata: {
            paymentTransactionId: updated.id,
            previousStatus: transaction.status,
            newStatus: 'PAID',
            adminId: adminSession.staffId,
            adminEmail: adminSession.email,
            reason,
            userId: updated.userId,
            externalId: updated.externalId,
            timestamp: now.toISOString(),
            ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown',
          },
        },
      });

      return updated;
    });

    console.log('[ADMIN_FORCE_APPROVE] Pagamento aprovado manualmente:', {
      paymentId: id,
      adminId: adminSession.staffId,
      adminEmail: adminSession.email,
      reason,
    });

    // Aplicar efeitos de domínio se for wallet_topup
    const metadata = result.metadata as Record<string, unknown> | null;

    if (metadata?.type === 'wallet_topup' && result.userId) {
      await walletService.creditFromGatewayTopup({
        userId: result.userId,
        amountCents: result.amountCents,
        currency: (metadata.currency as string) || 'BRL',
        paymentTransactionId: result.id,
        providerPaymentId: result.externalId || undefined,
      });

      console.log('[ADMIN_FORCE_APPROVE] Carteira creditada:', {
        userId: result.userId,
        amount: result.amountCents / 100,
        approvedBy: adminSession.email,
      });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.id,
        status: result.status,
        amountCents: result.amountCents,
        paidAt: result.paidAt,
      },
      audit: {
        approvedBy: adminSession.email,
        reason,
        timestamp: now.toISOString(),
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
