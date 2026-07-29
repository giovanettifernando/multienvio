import type { TransactionStatus, PaymentMethod } from '@prisma/client';
import type { AsaasBillingType } from './types';

/**
 * Mapeia o status de uma cobrança do Asaas para o enum interno.
 *
 * CONFIRMED -> CAPTURED é intencional: no cartão, CONFIRMED significa compra
 * aprovada (segundos) enquanto RECEIVED significa dinheiro liquidado (~30 dias).
 * O serviço é liberado na aprovação, conforme decidido na spec.
 */
export function mapAsaasStatus(status: string): TransactionStatus {
  const map: Record<string, TransactionStatus> = {
    PENDING: 'PENDING',
    AWAITING_RISK_ANALYSIS: 'PENDING',
    AWAITING_CHARGEBACK_REVERSAL: 'PENDING',
    CONFIRMED: 'CAPTURED',
    RECEIVED: 'PAID',
    RECEIVED_IN_CASH: 'PAID',
    REFUNDED: 'REFUNDED',
    REFUND_REQUESTED: 'REFUNDED',
    REFUND_IN_PROGRESS: 'REFUNDED',
    PARTIALLY_REFUNDED: 'REFUNDED',
    CHARGEBACK_REQUESTED: 'CHARGEBACK',
    CHARGEBACK_DISPUTE: 'CHARGEBACK',
    CREDIT_CARD_CAPTURE_REFUSED: 'FAILED',
    OVERDUE: 'CANCELED',
    DELETED: 'CANCELED',
  };
  return map[status] ?? 'PENDING';
}

export function mapBillingTypeToMethod(billingType: string): PaymentMethod {
  const map: Record<string, PaymentMethod> = {
    PIX: 'PIX',
    CREDIT_CARD: 'CREDIT_CARD',
    DEBIT_CARD: 'DEBIT_CARD',
    BOLETO: 'BOLETO',
  };
  return map[billingType] ?? 'CREDIT_CARD';
}

export function mapMethodToBillingType(
  method: 'pix' | 'credit_card' | 'boleto',
): AsaasBillingType {
  const map: Record<string, AsaasBillingType> = {
    pix: 'PIX',
    credit_card: 'CREDIT_CARD',
    boleto: 'BOLETO',
  };
  return map[method];
}
