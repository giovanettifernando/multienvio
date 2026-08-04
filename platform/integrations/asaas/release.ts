import type { TransactionStatus } from '@prisma/client';

/**
 * Decide se o serviço (emissão de etiqueta, crédito na carteira) pode ser liberado.
 *
 * CAPTURED = cartão aprovado (segundos). PAID = dinheiro recebido.
 * Qualquer outro estado — em especial PENDING, que é o caso do boleto recém-gerado
 * e do PIX ainda não pago — NÃO libera nada. Nesses casos quem libera é o worker
 * de webhook, quando o Asaas confirmar o pagamento.
 */
export function canReleaseService(status: TransactionStatus): boolean {
  return status === 'CAPTURED' || status === 'PAID';
}
