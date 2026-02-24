/**
 * Utilitários para Migração de Status
 *
 * Responsável por:
 * - Mapear status antigos para novos
 * - Validar transições de status
 * - Fornecer lógica de negócio para mudanças de status
 */

import { ShipmentStatus, CANCELLABLE_BEFORE_HANDOFF, CANCELLABLE_IN_TRANSIT } from './shipment-status';

/**
 * Mapeamento de status antigos (DB) para novos (Enum)
 * Usado durante a migração de dados
 */
export const LEGACY_STATUS_MIGRATION: Record<string, ShipmentStatus> = {
  // Status obsoletos
  'criado': ShipmentStatus.AWAITING_DROP_OFF_AT_POINT, // Default, será ajustado por lógica
  'pending_payment': ShipmentStatus.PICKUP_REQUESTED, // OBSOLETO - não deve mais existir após checkout
  'payment_failed': ShipmentStatus.CANCELLED_BEFORE_HANDOFF, // OBSOLETO

  // Status de origem
  'awaiting_pickup': ShipmentStatus.PICKUP_REQUESTED,
  'awaiting_posting': ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
  'ready_for_posting': ShipmentStatus.RECEIVED_AT_ORIGIN_HUB, // LEGACY/DEPRECATED

  // Status de transporte
  'posted': ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
  'in_transit': ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  'out_for_delivery': ShipmentStatus.OUT_FOR_DELIVERY,

  // Status de entrega
  'delivered': ShipmentStatus.DELIVERED,

  // Status de cancelamento
  'cancelled': ShipmentStatus.CANCELLED_BEFORE_HANDOFF, // Será ajustado por lógica
};

/**
 * Migra um status antigo para o novo padrão
 * Aplica regras de negócio se necessário
 *
 * @param legacyStatus Status antigo do banco de dados
 * @param context Contexto adicional (pickupPointId, etc)
 * @returns Status no novo padrão
 */
export function migrateLegacyStatus(
  legacyStatus: string,
  context?: {
    pickupPointId?: string | null;
    hasPickupRequest?: boolean;
    pickupRequestStatus?: string | null;
  }
): ShipmentStatus {
  // Caso especial: 'criado'
  if (legacyStatus === 'criado') {
    // Se tem pickup point, está aguardando entrega no ponto
    if (context?.pickupPointId) {
      return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
    }
    // Se tem pickup request, está aguardando coleta
    if (context?.hasPickupRequest) {
      return ShipmentStatus.PICKUP_REQUESTED;
    }
    // Default: consideramos como aguardando no ponto
    return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
  }

  // Caso especial: 'cancelled'
  if (legacyStatus === 'cancelled') {
    // Se tinha pickup request pendente, foi cancelado antes da coleta
    if (context?.pickupRequestStatus && ['PENDING', 'SCHEDULED'].includes(context.pickupRequestStatus)) {
      return ShipmentStatus.CANCELLED_BEFORE_HANDOFF;
    }
    // Se estava em ponto de coleta sem ser postado, foi cancelado antes
    if (context?.pickupPointId && !context?.pickupRequestStatus) {
      return ShipmentStatus.CANCELLED_BEFORE_HANDOFF;
    }
    // Caso contrário, consideramos como cancelado após entrega à transportadora
    return ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED;
  }

  // Migração direta do mapeamento
  const newStatus = LEGACY_STATUS_MIGRATION[legacyStatus];

  if (!newStatus) {
    console.warn(`[STATUS_MIGRATION] Status desconhecido: ${legacyStatus}. Usando AWAITING_DROP_OFF_AT_POINT como fallback.`);
    return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
  }

  return newStatus;
}

/**
 * Verifica se um status pode ser cancelado
 */
export function canBeCancelled(status: ShipmentStatus): boolean {
  return (
    (CANCELLABLE_BEFORE_HANDOFF as readonly ShipmentStatus[]).includes(status) ||
    (CANCELLABLE_IN_TRANSIT as readonly ShipmentStatus[]).includes(status)
  );
}

/**
 * Determina o próximo status de cancelamento
 */
export function getNextCancellationStatus(currentStatus: ShipmentStatus): ShipmentStatus | null {
  // Se pode cancelar antes da transportadora assumir
  if ((CANCELLABLE_BEFORE_HANDOFF as readonly ShipmentStatus[]).includes(currentStatus)) {
    return ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF;
  }

  // Se pode cancelar quando já está em trânsito
  if ((CANCELLABLE_IN_TRANSIT as readonly ShipmentStatus[]).includes(currentStatus)) {
    return ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT;
  }

  // Não pode ser cancelado
  return null;
}

/**
 * Fluxo de cancelamento antes da transportadora assumir
 */
export function processCancellationBeforeHandoff(
  currentStatus: ShipmentStatus
): ShipmentStatus {
  if (currentStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF) {
    return ShipmentStatus.CANCELLED_BEFORE_HANDOFF;
  }

  throw new Error(`Status ${currentStatus} não pode usar este fluxo de cancelamento`);
}

/**
 * Fluxo de cancelamento quando transportadora já tem os volumes
 */
export function processCancellationInTransit(
  currentStatus: ShipmentStatus,
  step: 'request' | 'returning' | 'returned'
): ShipmentStatus {
  switch (step) {
    case 'request':
      return ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT;
    case 'returning':
      return ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING;
    case 'returned':
      return ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED;
    default:
      throw new Error(`Passo de cancelamento inválido: ${step}`);
  }
}

/**
 * Matriz de transições válidas entre status
 * Define explicitamente quais transições são permitidas
 */
const TRANSITION_MATRIX: Record<ShipmentStatus, ShipmentStatus[]> = {
  // ========================================
  // FASE 0 - PROCESSAMENTO ASSÍNCRONO
  // ========================================

  [ShipmentStatus.PROCESSING]: [
    ShipmentStatus.PICKUP_REQUESTED,
    ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
    ShipmentStatus.CREATION_FAILED,
  ],

  [ShipmentStatus.CREATION_FAILED]: [], // FINAL

  // ========================================
  // FASE A - ORIGEM (Coleta/Postagem)
  // ========================================

  // Fluxo 1: Coleta no endereço do remetente
  [ShipmentStatus.PICKUP_REQUESTED]: [
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
  ],

  [ShipmentStatus.PICKUP_SCHEDULED]: [
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
    ShipmentStatus.PICKUP_FAILED,
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
  ],

  [ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN]: [
    ShipmentStatus.PICKUP_FAILED,
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
  ],

  [ShipmentStatus.PICKUP_FAILED]: [
    ShipmentStatus.PICKUP_REQUESTED, // Reagendar
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
  ],

  [ShipmentStatus.COLLECTED_FROM_SENDER]: [
    ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
    ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
  ],

  [ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB]: [
    ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ],

  [ShipmentStatus.RECEIVED_AT_ORIGIN_HUB]: [
    ShipmentStatus.IN_TRANSFER,
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ],

  // Fluxo 2: Ponto de coleta
  [ShipmentStatus.AWAITING_DROP_OFF_AT_POINT]: [
    ShipmentStatus.DROPPED_OFF_AT_POINT,
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
    ShipmentStatus.EXPIRED_NOT_POSTED,
  ],

  [ShipmentStatus.DROPPED_OFF_AT_POINT]: [
    ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
    ShipmentStatus.COLLECTED_FROM_POINT,
  ],

  [ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT]: [
    ShipmentStatus.COLLECTED_FROM_POINT,
  ],

  [ShipmentStatus.COLLECTED_FROM_POINT]: [
    ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  ],

  // ========================================
  // FASE B - TRANSPORTE
  // ========================================

  [ShipmentStatus.IN_TRANSFER]: [
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
    ShipmentStatus.AT_DESTINATION_HUB,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ],

  [ShipmentStatus.IN_TRANSIT_TO_DESTINATION]: [
    ShipmentStatus.AT_DESTINATION_HUB,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.DELIVERED, // Entrega direta
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ],

  [ShipmentStatus.AT_DESTINATION_HUB]: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ],

  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
    ShipmentStatus.DELIVERY_PROBLEM,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ],

  [ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB]: [
    ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
    ShipmentStatus.RETURNING_TO_SENDER, // Não retirado
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ],

  // ========================================
  // FASE C - ENTREGA E PROBLEMAS
  // ========================================

  [ShipmentStatus.DELIVERED]: [], // FINAL

  [ShipmentStatus.DELIVERED_AT_DESTINATION_HUB]: [], // FINAL

  [ShipmentStatus.DELIVERY_ATTEMPT_FAILED]: [
    ShipmentStatus.OUT_FOR_DELIVERY, // Nova tentativa
    ShipmentStatus.DELIVERY_PROBLEM,
    ShipmentStatus.RETURNING_TO_SENDER,
  ],

  [ShipmentStatus.DELIVERY_PROBLEM]: [
    ShipmentStatus.OUT_FOR_DELIVERY, // Corrigido, nova tentativa
    ShipmentStatus.RETURNING_TO_SENDER,
  ],

  // ========================================
  // FASE D - CANCELAMENTO E RETORNO
  // ========================================

  [ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF]: [
    ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
  ],

  [ShipmentStatus.CANCELLED_BEFORE_HANDOFF]: [], // FINAL

  [ShipmentStatus.EXPIRED_NOT_POSTED]: [], // FINAL

  [ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT]: [
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING,
  ],

  [ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING]: [
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
  ],

  [ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED]: [], // FINAL

  [ShipmentStatus.RETURNING_TO_SENDER]: [
    ShipmentStatus.RETURNED_TO_SENDER,
  ],

  [ShipmentStatus.RETURNED_TO_SENDER]: [], // FINAL
};

/**
 * Valida se uma transição de status é permitida
 * Usa a matriz de transições para validação rigorosa
 */
export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  // Se o status é o mesmo, é válido (noop)
  if (from === to) {
    return true;
  }

  // Verificar se a transição está na matriz
  const allowedTransitions = TRANSITION_MATRIX[from];
  if (!allowedTransitions) {
    // Status desconhecido
    return false;
  }

  return allowedTransitions.includes(to);
}

/**
 * Determina o status inicial de um shipment no checkout
 */
export function getInitialShipmentStatus(params: {
  hasPickupPoint: boolean;
  hasPickupRequest: boolean;
}): ShipmentStatus {
  if (params.hasPickupPoint) {
    // Cliente vai entregar no ponto de coleta
    return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
  }

  if (params.hasPickupRequest) {
    // Cliente solicitou coleta na origem
    return ShipmentStatus.PICKUP_REQUESTED;
  }

  // Fallback (não deveria acontecer)
  console.warn('[INITIAL_STATUS] Shipment sem pickup point nem pickup request. Usando AWAITING_DROP_OFF_AT_POINT.');
  return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
}
