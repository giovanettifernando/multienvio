import type { TransactionStatus } from "@prisma/client";

/**
 * Status de transação a partir dos quais um estorno pode ser solicitado.
 *
 * CAPTURED: cartão aprovado no Asaas (equivalente ao `CONFIRMED` deles). A
 * documentação do Asaas permite estornar cobranças "recebidas ou
 * confirmadas" — não é preciso esperar a liquidação (`PAID`/`RECEIVED`, que
 * leva ~30 dias) para poder estornar um cartão aprovado.
 * PAID: cobrança liquidada (`RECEIVED` no Asaas).
 *
 * `AUTHORIZED` foi removido deste conjunto: era semântica do fluxo antigo do
 * Pagar.me (autorização em duas etapas) e nenhum caminho de código vivo hoje
 * grava esse status numa `payment_transactions` real — `mapAsaasStatus`
 * nunca produz `AUTHORIZED`, e a única função que o fazia
 * (`authorizeTransaction` em platform/integrations/payments/payment-transaction.service.ts)
 * não é chamada por nenhuma rota. Se isso mudar, revise este conjunto.
 */
export const REFUNDABLE_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  "CAPTURED",
  "PAID",
];

export function isRefundableTransactionStatus(status: TransactionStatus): boolean {
  return REFUNDABLE_TRANSACTION_STATUSES.includes(status);
}
