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
 * Valida se uma transição de status é permitida
 * (implementação básica - pode ser expandida conforme regras de negócio)
 */
export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  // Transições sempre permitidas: para status de cancelamento
  if (Object.values(ShipmentStatus).includes(to) && to.includes('CANCELL')) {
    return canBeCancelled(from);
  }

  // TODO: Implementar validações mais específicas conforme necessário
  // Por enquanto, permite todas as transições
  return true;
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
