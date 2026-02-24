/**
 * Modelo Único de Status de Envios (Shipment Status)
 * Versão: 2.0
 *
 * Este enum representa a VERDADE OFICIAL para todos os status de envios.
 * Organizado por fases do ciclo de vida logístico.
 */

export enum ShipmentStatus {
  // ========================================
  // FASE 0 - PROCESSAMENTO ASSÍNCRONO
  // ========================================

  /** Envio criado, aguardando integração com transportadora */
  PROCESSING = 'PROCESSING',

  /** Integração com transportadora falhou após todas as tentativas */
  CREATION_FAILED = 'CREATION_FAILED',

  // ========================================
  // FASE A - ORIGEM (Coleta/Postagem)
  // ========================================

  // --- Fluxo 1: Coleta no endereço do remetente ---

  /** Coleta solicitada - Remetente escolheu "coleta na origem" no checkout */
  PICKUP_REQUESTED = 'PICKUP_REQUESTED',

  /** Coleta agendada - Coletor definiu data/hora na fila de coletas */
  PICKUP_SCHEDULED = 'PICKUP_SCHEDULED',

  /** Aguardando coleta no endereço - Aguardando o coletor aparecer na janela combinada */
  AWAITING_PICKUP_AT_ORIGIN = 'AWAITING_PICKUP_AT_ORIGIN',

  /** Coleta não realizada - Ex.: remetente ausente, endereço incorreto */
  PICKUP_FAILED = 'PICKUP_FAILED',

  /** Volumes coletados do remetente - Coletor retirou os volumes */
  COLLECTED_FROM_SENDER = 'COLLECTED_FROM_SENDER',

  /** Em trânsito para a base da transportadora - Coletor levando até o CD */
  IN_TRANSIT_TO_CARRIER_HUB = 'IN_TRANSIT_TO_CARRIER_HUB',

  /** Recebido na base da transportadora (origem) - Transportadora deu entrada */
  RECEIVED_AT_ORIGIN_HUB = 'RECEIVED_AT_ORIGIN_HUB',

  // --- Fluxo 2: Ponto de coleta ---

  /** Aguardando entrega no ponto de coleta - Remetente optou por entregar em ponto */
  AWAITING_DROP_OFF_AT_POINT = 'AWAITING_DROP_OFF_AT_POINT',

  /** Entregue no ponto de coleta - Ponto de coleta registrou a entrada */
  DROPPED_OFF_AT_POINT = 'DROPPED_OFF_AT_POINT',

  /** Aguardando coleta pela transportadora - Volume está no ponto esperando */
  AWAITING_CARRIER_PICKUP_AT_POINT = 'AWAITING_CARRIER_PICKUP_AT_POINT',

  /** Coletado no ponto de coleta - Transportadora recolheu os volumes */
  COLLECTED_FROM_POINT = 'COLLECTED_FROM_POINT',

  // ========================================
  // FASE B - TRANSPORTE
  // ========================================

  /** Em transferência entre bases - Movimentação entre CDs da transportadora */
  IN_TRANSFER = 'IN_TRANSFER',

  /** Em trânsito para cidade de destino - Viagem principal */
  IN_TRANSIT_TO_DESTINATION = 'IN_TRANSIT_TO_DESTINATION',

  /** Recebido na base da transportadora (destino) - Chegou no CD de destino */
  AT_DESTINATION_HUB = 'AT_DESTINATION_HUB',

  /** Em rota de entrega - Saiu para entrega final */
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',

  /** Aguardando retirada na unidade da transportadora (destino) - Disponível para pickup */
  AWAITING_PICKUP_AT_DESTINATION_HUB = 'AWAITING_PICKUP_AT_DESTINATION_HUB',

  // ========================================
  // FASE C - ENTREGA E PROBLEMAS
  // ========================================

  /** Entregue ao destinatário - Entrega concluída */
  DELIVERED = 'DELIVERED',

  /** Disponível para retirada na unidade - Destinatário deve retirar */
  DELIVERED_AT_DESTINATION_HUB = 'DELIVERED_AT_DESTINATION_HUB',

  /** Tentativa de entrega não realizada - Ex.: destinatário ausente */
  DELIVERY_ATTEMPT_FAILED = 'DELIVERY_ATTEMPT_FAILED',

  /** Problema na entrega - Ex.: endereço incorreto, área de risco */
  DELIVERY_PROBLEM = 'DELIVERY_PROBLEM',

  // ========================================
  // FASE D - CANCELAMENTO E RETORNO
  // ========================================

  // --- Cancelamento antes da transportadora assumir ---

  /** Cancelamento solicitado (antes da postagem) - Cliente pediu cancelamento */
  CANCELLATION_REQUESTED_BEFORE_HANDOFF = 'CANCELLATION_REQUESTED_BEFORE_HANDOFF',

  /** Cancelado antes de entregar à transportadora - Cancelamento confirmado */
  CANCELLED_BEFORE_HANDOFF = 'CANCELLED_BEFORE_HANDOFF',

  /** Etiqueta/solicitação expirada sem postagem/coleta - Prazo expirou */
  EXPIRED_NOT_POSTED = 'EXPIRED_NOT_POSTED',

  // --- Cancelamento quando transportadora já tem os volumes ---

  /** Cancelamento solicitado (em trânsito) - Cliente pediu cancelamento após postagem */
  CANCELLATION_REQUESTED_IN_TRANSIT = 'CANCELLATION_REQUESTED_IN_TRANSIT',

  /** Cancelado em trânsito – em devolução ao remetente - Devolução iniciada */
  CANCELLED_IN_TRANSIT_RETURNING = 'CANCELLED_IN_TRANSIT_RETURNING',

  /** Cancelado em trânsito – devolvido ao remetente - Devolução concluída */
  CANCELLED_IN_TRANSIT_RETURNED = 'CANCELLED_IN_TRANSIT_RETURNED',

  // --- Devolução sem cancelamento explícito ---

  /** Em devolução ao remetente - Retorno por problema de entrega/recusa */
  RETURNING_TO_SENDER = 'RETURNING_TO_SENDER',

  /** Devolvido ao remetente - Retorno concluído */
  RETURNED_TO_SENDER = 'RETURNED_TO_SENDER',
}

/**
 * Grupos de status por fase do ciclo de vida
 */
export const StatusPhases = {
  /** Status da Fase A - Origem */
  ORIGIN: [
    ShipmentStatus.PICKUP_REQUESTED,
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
    ShipmentStatus.PICKUP_FAILED,
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
    ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
    ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
    ShipmentStatus.DROPPED_OFF_AT_POINT,
    ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
    ShipmentStatus.COLLECTED_FROM_POINT,
  ] as const,

  /** Status da Fase B - Transporte */
  TRANSPORT: [
    ShipmentStatus.IN_TRANSFER,
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
    ShipmentStatus.AT_DESTINATION_HUB,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
  ] as const,

  /** Status da Fase C - Entrega */
  DELIVERY: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
    ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
    ShipmentStatus.DELIVERY_PROBLEM,
  ] as const,

  /** Status da Fase D - Cancelamento e Retorno */
  CANCELLATION: [
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
    ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
    ShipmentStatus.EXPIRED_NOT_POSTED,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
    ShipmentStatus.RETURNING_TO_SENDER,
    ShipmentStatus.RETURNED_TO_SENDER,
  ] as const,
} as const;

/**
 * Status que permitem cancelamento antes da transportadora assumir
 */
export const CANCELLABLE_BEFORE_HANDOFF = [
  ShipmentStatus.PICKUP_REQUESTED,
  ShipmentStatus.PICKUP_SCHEDULED,
  ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
  ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
] as const;

/**
 * Status que permitem cancelamento quando a transportadora já tem os volumes
 */
export const CANCELLABLE_IN_TRANSIT = [
  ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
  ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
  ShipmentStatus.IN_TRANSFER,
  ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  ShipmentStatus.AT_DESTINATION_HUB,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
] as const;

/**
 * Status finais (não podem mais mudar)
 */
export const FINAL_STATUSES = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
  ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
  ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
  ShipmentStatus.RETURNED_TO_SENDER,
  ShipmentStatus.EXPIRED_NOT_POSTED,
] as const;

/**
 * Mapeamento de labels amigáveis para exibição
 */
export const ShipmentStatusLabels: Record<ShipmentStatus, string> = {
  // Fase 0 - Processamento
  [ShipmentStatus.PROCESSING]: 'Processando',
  [ShipmentStatus.CREATION_FAILED]: 'Falha na criação',

  // Fase A - Origem
  [ShipmentStatus.PICKUP_REQUESTED]: 'Coleta solicitada',
  [ShipmentStatus.PICKUP_SCHEDULED]: 'Coleta agendada',
  [ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN]: 'Aguardando coleta',
  [ShipmentStatus.PICKUP_FAILED]: 'Coleta não realizada',
  [ShipmentStatus.COLLECTED_FROM_SENDER]: 'Coletado do remetente',
  [ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB]: 'Em trânsito para base',
  [ShipmentStatus.RECEIVED_AT_ORIGIN_HUB]: 'Recebido na base',
  [ShipmentStatus.AWAITING_DROP_OFF_AT_POINT]: 'Aguardando entrega no ponto',
  [ShipmentStatus.DROPPED_OFF_AT_POINT]: 'Entregue no ponto',
  [ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT]: 'Aguardando coleta no ponto',
  [ShipmentStatus.COLLECTED_FROM_POINT]: 'Coletado no ponto',

  // Fase B - Transporte
  [ShipmentStatus.IN_TRANSFER]: 'Em transferência',
  [ShipmentStatus.IN_TRANSIT_TO_DESTINATION]: 'Em trânsito',
  [ShipmentStatus.AT_DESTINATION_HUB]: 'Na base de destino',
  [ShipmentStatus.OUT_FOR_DELIVERY]: 'Em rota de entrega',
  [ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB]: 'Aguardando retirada',

  // Fase C - Entrega
  [ShipmentStatus.DELIVERED]: 'Entregue',
  [ShipmentStatus.DELIVERED_AT_DESTINATION_HUB]: 'Disponível para retirada',
  [ShipmentStatus.DELIVERY_ATTEMPT_FAILED]: 'Tentativa de entrega falhou',
  [ShipmentStatus.DELIVERY_PROBLEM]: 'Problema na entrega',

  // Fase D - Cancelamento
  [ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF]: 'Cancelamento solicitado',
  [ShipmentStatus.CANCELLED_BEFORE_HANDOFF]: 'Cancelado',
  [ShipmentStatus.EXPIRED_NOT_POSTED]: 'Expirado',
  [ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT]: 'Cancelamento em análise',
  [ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING]: 'Em devolução',
  [ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED]: 'Devolvido',
  [ShipmentStatus.RETURNING_TO_SENDER]: 'Em devolução',
  [ShipmentStatus.RETURNED_TO_SENDER]: 'Devolvido ao remetente',
};

/**
 * Cores para exibição (compatível com Ant Design Tag)
 */
export const ShipmentStatusColors: Record<ShipmentStatus, string> = {
  // Fase 0 - Processamento
  [ShipmentStatus.PROCESSING]: 'processing',
  [ShipmentStatus.CREATION_FAILED]: 'red',

  // Fase A - Origem
  [ShipmentStatus.PICKUP_REQUESTED]: 'blue',
  [ShipmentStatus.PICKUP_SCHEDULED]: 'cyan',
  [ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN]: 'geekblue',
  [ShipmentStatus.PICKUP_FAILED]: 'red',
  [ShipmentStatus.COLLECTED_FROM_SENDER]: 'purple',
  [ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB]: 'blue',
  [ShipmentStatus.RECEIVED_AT_ORIGIN_HUB]: 'green',
  [ShipmentStatus.AWAITING_DROP_OFF_AT_POINT]: 'orange',
  [ShipmentStatus.DROPPED_OFF_AT_POINT]: 'cyan',
  [ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT]: 'geekblue',
  [ShipmentStatus.COLLECTED_FROM_POINT]: 'purple',

  // Fase B - Transporte
  [ShipmentStatus.IN_TRANSFER]: 'blue',
  [ShipmentStatus.IN_TRANSIT_TO_DESTINATION]: 'blue',
  [ShipmentStatus.AT_DESTINATION_HUB]: 'cyan',
  [ShipmentStatus.OUT_FOR_DELIVERY]: 'gold',
  [ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB]: 'lime',

  // Fase C - Entrega
  [ShipmentStatus.DELIVERED]: 'green',
  [ShipmentStatus.DELIVERED_AT_DESTINATION_HUB]: 'green',
  [ShipmentStatus.DELIVERY_ATTEMPT_FAILED]: 'orange',
  [ShipmentStatus.DELIVERY_PROBLEM]: 'red',

  // Fase D - Cancelamento
  [ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF]: 'orange',
  [ShipmentStatus.CANCELLED_BEFORE_HANDOFF]: 'red',
  [ShipmentStatus.EXPIRED_NOT_POSTED]: 'default',
  [ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT]: 'orange',
  [ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING]: 'volcano',
  [ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED]: 'red',
  [ShipmentStatus.RETURNING_TO_SENDER]: 'magenta',
  [ShipmentStatus.RETURNED_TO_SENDER]: 'red',
};
