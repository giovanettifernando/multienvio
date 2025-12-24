/**
 * Wallet Balance Service
 *
 * Gerencia overview da carteira com saldo, resumo mensal e transações recentes.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import type { PrismaClient } from '@prisma/client';
import { getOrCreateWallet, centsToReais } from './wallet.service';
import { getWalletBalance } from './ledger-balance.service';
import { getCurrentMonthRange, calculatePeriodSummary } from './period-summary';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
  formatTransactionAmount,
} from './transaction-direction';
import { formatWalletDescription } from '@/shared/utils/format';
import type { WalletBalanceResponse } from '@/shared/types/wallet-statement';

// =============================================================================
// Types
// =============================================================================

export interface BalanceServiceDeps {
  prisma: PrismaClient | any;
}

const defaultDeps: BalanceServiceDeps = {
  prisma: defaultPrisma,
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Retorna overview completo da carteira do usuário.
 */
export async function getWalletOverview(
  userId: string,
  deps: BalanceServiceDeps = defaultDeps
): Promise<WalletBalanceResponse> {
  const { prisma } = deps;

  // Get or create wallet
  const wallet = await getOrCreateWallet(userId);

  // Get current month range
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

  // Fetch monthly transactions
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

  // Calculate monthly summary
  const monthlySummary = calculatePeriodSummary(
    monthlyTransactions,
    monthStart,
    monthEnd
  );

  // Fetch latest 10 transactions
  const latestTransactions = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
      status: 'CONFIRMED',
    },
    orderBy: { confirmedAt: 'desc' },
    take: 10,
  });

  // Map transactions to DTO
  const transactionsDTO = latestTransactions.map((tx: any) => {
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

  // ARQUITETURA: Saldo calculado do ledger (fonte única de verdade)
  const ledgerBalance = await getWalletBalance(wallet.id);

  return {
    balance: {
      availableReais: centsToReais(ledgerBalance.availableCents),
      availableCents: ledgerBalance.availableCents,
      pendingReais: centsToReais(ledgerBalance.pendingCents),
      pendingCents: ledgerBalance.pendingCents,
    },
    monthlySummary,
    latestTransactions: transactionsDTO,
  };
}
