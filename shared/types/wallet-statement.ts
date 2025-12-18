import { WalletTxType, WalletTxStatus } from '@prisma/client';
import { TransactionDirection } from '@/modules/wallet/application/transaction-direction';

/**
 * DTO de transação com direção (crédito/débito)
 */
export interface WalletTransactionDTO {
  id: string;
  type: WalletTxType;
  typeLabel: string;
  status: WalletTxStatus;
  amountCents: number;
  amountReais: number;
  direction: TransactionDirection;
  formattedAmount: string; // Ex: "+ R$ 100,00" ou "- R$ 50,00"
  title: string | null;
  description: string | null;
  referenceId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

/**
 * Resumo de período (créditos, débitos, saldo)
 */
export interface PeriodSummary {
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  totalCredits: number; // Em reais
  totalDebits: number; // Em reais
  netAmount: number; // Créditos - Débitos (em reais)
  transactionCount: number;
}

/**
 * Resposta da API de carteira (saldo + resumo mensal)
 */
export interface WalletBalanceResponse {
  balance: {
    availableReais: number;
    availableCents: number;
    pendingReais: number;
    pendingCents: number;
  };
  monthlySummary: PeriodSummary;
  latestTransactions: WalletTransactionDTO[];
}

/**
 * Parâmetros de filtro para extrato
 */
export interface StatementFilters {
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  search?: string; // Busca por descrição/tipo
  page?: number;
  limit?: number;
}

/**
 * Resposta da API de extrato (transações + resumo do período)
 */
export interface StatementResponse {
  transactions: WalletTransactionDTO[];
  summary: PeriodSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
