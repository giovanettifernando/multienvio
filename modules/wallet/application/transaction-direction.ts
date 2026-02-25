import { WalletTxType } from '@prisma/client';
import { formatNumberBR } from '@/shared/utils/format';

/**
 * Direção da transação (crédito ou débito)
 */
export type TransactionDirection = 'credit' | 'debit';

/**
 * Determinar se uma transação é crédito ou débito
 *
 * REGRAS:
 * - Créditos: TOPUP, REFUND (valores entram na carteira)
 * - Débitos: PURCHASE, WITHDRAW (valores saem da carteira)
 * - Ajustes: podem ser crédito ou débito dependendo do valor
 */
export function getTransactionDirection(
  type: WalletTxType,
  amountCents: number
): TransactionDirection {
  // TOPUP e REFUND são sempre créditos
  if (type === 'TOPUP' || type === 'REFUND') {
    return 'credit';
  }

  // PURCHASE e WITHDRAW são sempre débitos
  if (type === 'PURCHASE' || type === 'WITHDRAW') {
    return 'debit';
  }

  // ADJUSTMENT pode ser crédito ou débito dependendo do sinal
  if (type === 'ADJUSTMENT') {
    return amountCents >= 0 ? 'credit' : 'debit';
  }

  // Fallback baseado no valor
  return amountCents >= 0 ? 'credit' : 'debit';
}

/**
 * Obter label amigável para tipo de transação
 */
export function getTransactionTypeLabel(type: WalletTxType): string {
  const labels: Record<WalletTxType, string> = {
    TOPUP: 'Recarga',
    PURCHASE: 'Compra',
    REFUND: 'Reembolso',
    WITHDRAW: 'Saque',
    ADJUSTMENT: 'Ajuste',
  };

  return labels[type] || type;
}

/**
 * Formatar valor com sinal (+/-)
 */
export function formatTransactionAmount(
  amountCents: number,
  direction: TransactionDirection
): string {
  const reais = Math.abs(amountCents) / 100;
  const formatted = formatNumberBR(reais);
  const sign = direction === 'credit' ? '+' : '-';
  return `${sign} R$ ${formatted}`;
}
