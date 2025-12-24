/**
 * POST /api/admin/clients/[id]/wallet/adjust
 *
 * Ajusta o saldo da carteira de um usuário (Admin)
 * Permite adicionar crédito ou débito manualmente
 *
 * SECURITY:
 * - Usa FOR UPDATE para lock pessimista (evita race conditions)
 * - Valida saldo suficiente antes do débito
 * - Auditoria completa de todas as operações
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

import { AdminPermission, WalletTxType, WalletTxStatus } from '@prisma/client';
import { getOrCreateWallet } from '@/modules/wallet/application/wallet.service';
import { logger } from '@/platform/logging/logger';

const adjustSchema = z.object({
  type: z.enum(['credit', 'debit']),
  amountCents: z.number().int().positive('Valor deve ser positivo'),
  reason: z.string().min(3, 'Motivo deve ter pelo menos 3 caracteres'),
});

export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = params.id;
  const body = await req.json();

  const validation = adjustSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  const { type, amountCents, reason } = validation.data;

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  // Buscar ou criar carteira
  const initialWallet = await getOrCreateWallet(userId);

  // Calcular valor da transação (negativo para débito)
  const transactionAmount = type === 'credit' ? amountCents : -amountCents;

  // SECURITY: Usar $transaction com FOR UPDATE para lock pessimista
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    // Lock da wallet com FOR UPDATE para evitar race conditions
    const lockedWallets = await tx.$queryRaw<Array<{ id: string; availableCents: number }>>`
      SELECT id, "availableCents" FROM wallets
      WHERE id = ${initialWallet.id}
      FOR UPDATE
    `;

    if (!lockedWallets || lockedWallets.length === 0) {
      throw new Error('Wallet not found after lock');
    }

    const wallet = lockedWallets[0];

    // SECURITY: Validar saldo suficiente para débito
    if (type === 'debit' && wallet.availableCents < amountCents) {
      throw new ApiError({
        code: 'INSUFFICIENT_BALANCE',
        message: `Saldo insuficiente. Disponível: R$ ${(wallet.availableCents / 100).toFixed(2)}, Solicitado: R$ ${(amountCents / 100).toFixed(2)}`,
        status: 400,
      });
    }

    // Criar transação de ajuste
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxType.ADJUSTMENT,
        status: WalletTxStatus.CONFIRMED,
        amountCents: transactionAmount,
        title:
          type === 'credit'
            ? 'Crédito adicionado pela plataforma'
            : 'Débito adicionado pela plataforma',
        confirmedAt: now,
        meta: {
          adjustmentType: type,
          reason,
          description: reason,
          adminId: session.staffId,
          adminName: session.email,
          timestamp: now.toISOString(),
        },
      },
    });

    // Atualizar saldo
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents:
          type === 'credit'
            ? { increment: amountCents }
            : { decrement: amountCents },
      },
    });

    return { transaction, wallet, updatedWallet };
  });

  const { transaction, wallet, updatedWallet } = result;

  // Log de auditoria
  logger.info({
    event: 'admin_wallet_adjust',
    adminId: session.staffId,
    adminEmail: session.email,
    userId,
    userEmail: user.email,
    type,
    amountCents,
    reason,
    transactionId: transaction.id,
    previousBalance: wallet.availableCents,
    newBalance: updatedWallet.availableCents,
  }, 'Admin adjusted wallet balance');

  return {
    data: {
      message:
        type === 'credit'
          ? `Crédito de R$ ${(amountCents / 100).toFixed(2)} adicionado com sucesso`
          : `Débito de R$ ${(amountCents / 100).toFixed(2)} registrado com sucesso`,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amountCents: transaction.amountCents,
        title: transaction.title,
        createdAt: transaction.createdAt,
      },
      wallet: {
        previousBalance: wallet.availableCents,
        newBalance: updatedWallet.availableCents,
        previousBalanceReais: wallet.availableCents / 100,
        newBalanceReais: updatedWallet.availableCents / 100,
      },
    },
  };
});
