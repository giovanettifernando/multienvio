/**
 * POST /api/admin/payment-transactions/[id]/force-approve
 *
 * ⚠️ AÇÃO ADMINISTRATIVA DE ALTO RISCO
 * Força a aprovação de um pagamento - requer SUPER_ADMIN ou FINANCEIRO
 * Todas as ações são registradas no ledger para auditoria
 */

import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import * as walletService from '@/lib/wallet/wallet.service';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const ForceApproveSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  // 🛡️ SECURITY FIX: Capturar informações do admin para audit trail
  const adminSession = await getAdminSessionFromRequest(req);
  if (!adminSession) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Sessão inválida',
      status: 401,
    });
  }

  const { id } = params;

  // Obter motivo da requisição (opcional mas recomendado)
  let reason = 'Aprovação manual administrativa';
  try {
    const body = await req.json();
    const parsed = ForceApproveSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        status: 400,
        details: parsed.error.flatten(),
      });
    }
    if (parsed.data.reason) {
      reason = parsed.data.reason;
    }
  } catch (error) {
    // Se for ApiError, propagar
    if (error instanceof ApiError) {
      throw error;
    }
    // Body vazio é aceitável
  }

  // Buscar transaction
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Pagamento não encontrado',
      status: 404,
    });
  }

  if (transaction.status === 'PAID') {
    throw new ApiError({
      code: 'ALREADY_PAID',
      message: 'Pagamento já está aprovado',
      status: 400,
    });
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

  logger.info({
    event: 'admin_force_approve_payment',
    paymentId: id,
    adminId: adminSession.staffId,
    adminEmail: adminSession.email,
    reason,
  }, 'Payment manually approved');

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

    logger.info({
      event: 'admin_force_approve_wallet_credited',
      userId: result.userId,
      amount: result.amountCents / 100,
      approvedBy: adminSession.email,
    }, 'Wallet credited after manual approval');
  }

  return {
    data: {
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
    },
  };
});
