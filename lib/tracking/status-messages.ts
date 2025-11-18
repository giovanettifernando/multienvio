/**
 * Mapeamento de status/tipos de evento para mensagens públicas amigáveis
 * Usado na timeline de rastreamento público
 */

export const PUBLIC_STATUS_MESSAGES: Record<string, string> = {
  // Status de shipment
  pending_payment: 'Aguardando pagamento',
  awaiting_pickup: 'Aguardando coleta',
  awaiting_posting: 'Aguardando postagem',
  ready_for_posting: 'Pronto para postagem',
  posted: 'Postado',
  in_transit: 'Em trânsito',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue ao destinatário',
  cancelled: 'Cancelado',
  payment_failed: 'Pagamento não confirmado',

  // Tipos de eventos (se diferentes)
  CREATED: 'Envio criado',
  PENDING_PAYMENT: 'Aguardando pagamento',
  AWAITING_PICKUP: 'Aguardando coleta',
  AWAITING_POSTING: 'Aguardando postagem',
  READY_FOR_POSTING: 'Pronto para postagem',
  POSTED: 'Objeto postado',
  POSTED_AT_PICKUP_POINT: 'Postado no ponto de coleta',
  IN_TRANSIT: 'Objeto em trânsito',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Objeto entregue',
  DELIVERY_FAILED: 'Tentativa de entrega não realizada',
  RETURNED: 'Objeto devolvido',
  CANCELLED: 'Envio cancelado',
};

/**
 * Obter mensagem pública amigável para um status/tipo de evento
 */
export function getPublicStatusMessage(statusOrType: string): string {
  return PUBLIC_STATUS_MESSAGES[statusOrType] || PUBLIC_STATUS_MESSAGES[statusOrType.toUpperCase()] || 'Atualização de status';
}

/**
 * Tipos de evento para icones/cores na timeline
 */
export const EVENT_TYPES = {
  CREATED: 'CREATED',
  POSTED: 'POSTED',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  EXCEPTION: 'EXCEPTION',
  CANCELLED: 'CANCELLED',
} as const;
