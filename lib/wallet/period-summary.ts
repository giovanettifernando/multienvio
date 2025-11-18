import { WalletTransaction } from '@prisma/client';
import { getTransactionDirection } from './transaction-direction';
import { PeriodSummary } from '@/types/wallet-statement';

/**
 * Calcular resumo de período a partir de lista de transações
 */
export function calculatePeriodSummary(
  transactions: WalletTransaction[],
  periodStart: Date,
  periodEnd: Date
): PeriodSummary {
  let totalCreditsCents = 0;
  let totalDebitsCents = 0;

  // Filtrar apenas transações confirmadas
  const confirmedTransactions = transactions.filter(
    (tx) => tx.status === 'CONFIRMED'
  );

  for (const tx of confirmedTransactions) {
    const direction = getTransactionDirection(tx.type, tx.amountCents);

    if (direction === 'credit') {
      totalCreditsCents += Math.abs(tx.amountCents);
    } else {
      totalDebitsCents += Math.abs(tx.amountCents);
    }
  }

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalCredits: totalCreditsCents / 100,
    totalDebits: totalDebitsCents / 100,
    netAmount: (totalCreditsCents - totalDebitsCents) / 100,
    transactionCount: confirmedTransactions.length,
  };
}

/**
 * Obter datas do mês atual (primeiro e último dia)
 */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

/**
 * Obter datas dos últimos N dias
 */
export function getLastNDaysRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Formatar período para exibição
 */
export function formatPeriodLabel(periodStart: string, periodEnd: string): string {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const startStr = start.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const endStr = end.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return `${startStr} até ${endStr}`;
}
