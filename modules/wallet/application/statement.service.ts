/**
 * Wallet Statement Service
 *
 * Gerencia extrato de transações da carteira com filtros e resumo.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { ApiError } from '@/platform/api/errors';
import type { PrismaClient, Prisma } from '@prisma/client';
import { getLastNDaysRange } from './period-summary';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
  formatTransactionAmount,
} from './transaction-direction';
import { formatWalletDescription } from '@/shared/utils/format';
import type { StatementResponse } from '@/shared/types/wallet-statement';

// =============================================================================
// Types
// =============================================================================

export interface StatementFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface StatementPagination {
  page: number;
  limit: number;
}

export interface StatementServiceDeps {
  prisma: PrismaClient | any;
}

const defaultDeps: StatementServiceDeps = {
  prisma: defaultPrisma,
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Retorna extrato de transações da carteira com filtros e resumo do período.
 */
export async function getWalletStatement(
  userId: string,
  filters: StatementFilters,
  pagination: StatementPagination,
  deps: StatementServiceDeps = defaultDeps
): Promise<StatementResponse> {
  const { prisma } = deps;
  const { dateFrom, dateTo, search } = filters;
  const { page, limit } = pagination;

  // Get wallet
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    throw new ApiError({ code: 'not_found', message: 'Carteira não encontrada', status: 404 });
  }

  // Define date range (default: last 30 days)
  let periodStart: Date;
  let periodEnd: Date;

  if (dateFrom && dateTo) {
    periodStart = new Date(dateFrom + 'T00:00:00.000Z');
    periodEnd = new Date(dateTo + 'T23:59:59.999Z');
  } else {
    const range = getLastNDaysRange(30);
    periodStart = range.start;
    periodEnd = range.end;
  }

  // Build WHERE clause
  const whereClause: Prisma.WalletTransactionWhereInput = {
    walletId: wallet.id,
    status: 'CONFIRMED',
    confirmedAt: {
      gte: periodStart,
      lte: periodEnd,
    },
  };

  if (search && search.trim()) {
    whereClause.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { referenceId: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  // Base filter for period aggregations
  const periodWhereBase = {
    walletId: wallet.id,
    status: 'CONFIRMED' as const,
    confirmedAt: {
      gte: periodStart,
      lte: periodEnd,
    },
  };

  // Execute all queries in parallel
  const [total, transactions, creditsAgg, debitsAgg] = await Promise.all([
    prisma.walletTransaction.count({ where: whereClause }),
    prisma.walletTransaction.findMany({
      where: whereClause,
      orderBy: { confirmedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.walletTransaction.aggregate({
      where: {
        ...periodWhereBase,
        OR: [
          { type: 'TOPUP' },
          { type: 'REFUND' },
          { type: 'ADJUSTMENT', amountCents: { gte: 0 } },
        ],
      },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.walletTransaction.aggregate({
      where: {
        ...periodWhereBase,
        OR: [
          { type: 'PURCHASE' },
          { type: 'WITHDRAW' },
          { type: 'ADJUSTMENT', amountCents: { lt: 0 } },
        ],
      },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  const totalCreditsCents = creditsAgg._sum.amountCents || 0;
  const totalDebitsCents = Math.abs(debitsAgg._sum.amountCents || 0);
  const transactionCount = creditsAgg._count + debitsAgg._count;

  const summary = {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalCredits: totalCreditsCents / 100,
    totalDebits: totalDebitsCents / 100,
    netAmount: (totalCreditsCents - totalDebitsCents) / 100,
    transactionCount,
  };

  const transactionsDTO = mapTransactionsToDTO(transactions);

  return {
    transactions: transactionsDTO,
    summary,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };
}

/**
 * Maps transactions to DTOs.
 */
export function mapTransactionsToDTO(transactions: any[]) {
  return transactions.map((tx) => {
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
}
