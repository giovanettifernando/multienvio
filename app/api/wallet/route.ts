/**
 * GET /api/wallet
 *
 * Retorna o saldo da carteira + resumo mensal + últimas transações
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { getOrCreateWallet, centsToReais } from '@/lib/wallet/wallet.service';
import { prisma } from '@/lib/db';
import { getCurrentMonthRange, calculatePeriodSummary } from '@/lib/wallet/period-summary';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
  formatTransactionAmount,
} from '@/lib/wallet/transaction-direction';
import { formatWalletDescription } from '@/lib/format';
import type { WalletBalanceResponse } from '@/types/wallet-statement';


export const GET = withApiHandler<WalletBalanceResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  // Buscar ou criar carteira (evita race condition)
  const wallet = await getOrCreateWallet(session.userId);

  // Obter intervalo do mês atual
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

  // Buscar transações do mês atual (apenas confirmadas)
  const monthlyTransactions = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
      status: 'CONFIRMED',
      confirmedAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    orderBy: { confirmedAt: 'desc' },
  });

  // Calcular resumo mensal
  const monthlySummary = calculatePeriodSummary(
    monthlyTransactions,
    monthStart,
    monthEnd
  );

  // Buscar últimas 10 transações (confirmadas)
  const latestTransactions = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
      status: 'CONFIRMED',
    },
    orderBy: { confirmedAt: 'desc' },
    take: 10,
  });

  // Formatar transações para DTO
  const transactionsDTO = latestTransactions.map((tx) => {
    const direction = getTransactionDirection(tx.type, tx.amountCents);
    const typeLabel = getTransactionTypeLabel(tx.type);

    return {
      id: tx.id,
      type: tx.type,
      typeLabel,
      status: tx.status,
      amountCents: tx.amountCents,
      amountReais: tx.amountCents / 100,
      direction,
      formattedAmount: formatTransactionAmount(tx.amountCents, direction),
      title: tx.title,
      description: formatWalletDescription(tx.title) || typeLabel,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt.toISOString(),
      confirmedAt: tx.confirmedAt?.toISOString() || null,
    };
  });

  const response: WalletBalanceResponse = {
    balance: {
      availableReais: centsToReais(wallet.availableCents),
      availableCents: wallet.availableCents,
      pendingReais: centsToReais(wallet.pendingCents),
      pendingCents: wallet.pendingCents,
    },
    monthlySummary,
    latestTransactions: transactionsDTO,
  };

  return { data: response };
});
