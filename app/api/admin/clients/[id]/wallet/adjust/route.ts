/**
 * POST /api/admin/clients/[id]/wallet/adjust
 *
 * Ajusta o saldo da carteira de um usuário (Admin)
 * Permite adicionar crédito ou débito manualmente
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission, WalletTxType, WalletTxStatus } from '@prisma/client';
import { getOrCreateWallet } from '@/lib/wallet/wallet.service';

const adjustSchema = z.object({
  type: z.enum(['credit', 'debit']),
  amountCents: z.number().int().positive('Valor deve ser positivo'),
  reason: z.string().min(3, 'Motivo deve ter pelo menos 3 caracteres'),
});

export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

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
  const wallet = await getOrCreateWallet(userId);

  // Calcular valor da transação (negativo para débito)
  const transactionAmount = type === 'credit' ? amountCents : -amountCents;

  // Criar transação e atualizar saldo em uma transaction
  const now = new Date();
  const [transaction, updatedWallet] = await prisma.$transaction([
    prisma.walletTransaction.create({
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
          adminId: authResult.user.id,
          adminName: authResult.user.name || authResult.user.email,
          timestamp: now.toISOString(),
        },
      },
    }),
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents:
          type === 'credit'
            ? { increment: amountCents }
            : { decrement: amountCents },
      },
    }),
  ]);

  // Log de auditoria
  console.log('[ADMIN_WALLET_ADJUST]', {
    adminId: authResult.user.id,
    adminEmail: authResult.user.email,
    userId,
    userEmail: user.email,
    type,
    amountCents,
    reason,
    transactionId: transaction.id,
    previousBalance: wallet.availableCents,
    newBalance: updatedWallet.availableCents,
  });

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
