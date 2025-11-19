/**
 * Mapeamento de Status para Labels da UI (PT-BR)
 * Usado em endpoints de API para traduzir status do banco para labels amigáveis
 */

import { ShipmentStatus, ShipmentStatusLabels } from './shipment-status';

/**
 * Status simplificados para exibição na UI do frontend
 * (compatibilidade temporária com o tipo antigo src/types/shipments.ts)
 */
export type UIShipmentStatus =
  | "Aguardando coleta"
  | "Aguardando postagem"
  | "Postado"
  | "Em trânsito"
  | "Em rota de entrega"
  | "Entregue"
  | "Cancelado"
  | "Devolvido";

/**
 * Mapeia status do enum completo para status simplificados da UI
 * (Para manter compatibilidade com o frontend atual)
 */
export function mapToUIStatus(status: ShipmentStatus): UIShipmentStatus {
  // Fase A - Origem (Coleta)
  if ([
    ShipmentStatus.PICKUP_REQUESTED,
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
  ].includes(status)) {
    return "Aguardando coleta";
  }

  if (status === ShipmentStatus.PICKUP_FAILED) {
    return "Cancelado";
  }

  if ([
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
  ].includes(status)) {
    return "Em trânsito";
  }

  // Fase A - Origem (Ponto de Coleta)
  if ([
    ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
    ShipmentStatus.DROPPED_OFF_AT_POINT,
    ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
  ].includes(status)) {
    return "Aguardando postagem";
  }

  if (status === ShipmentStatus.COLLECTED_FROM_POINT) {
    return "Em trânsito";
  }

  // Fase A/B - Transportadora assumiu
  if ([
    ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
    ShipmentStatus.IN_TRANSFER,
  ].includes(status)) {
    return "Postado";
  }

  // Fase B - Transporte
  if ([
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
    ShipmentStatus.AT_DESTINATION_HUB,
  ].includes(status)) {
    return "Em trânsito";
  }

  if ([
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
  ].includes(status)) {
    return "Em rota de entrega";
  }

  // Fase C - Entrega
  if ([
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
  ].includes(status)) {
    return "Entregue";
  }

  if ([
    ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
    ShipmentStatus.DELIVERY_PROBLEM,
  ].includes(status)) {
    return "Em rota de entrega"; // Ainda tentando entregar
  }

  // Fase D - Cancelamento
  if ([
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
    ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
    ShipmentStatus.EXPIRED_NOT_POSTED,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
  ].includes(status)) {
    return "Cancelado";
  }

  if ([
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
    ShipmentStatus.RETURNING_TO_SENDER,
    ShipmentStatus.RETURNED_TO_SENDER,
  ].includes(status)) {
    return "Devolvido";
  }

  // Fallback (não deveria acontecer)
  console.warn(`[MAP_UI_STATUS] Status desconhecido: ${status}`);
  return "Em trânsito";
}

/**
 * Retorna label detalhada em PT-BR
 */
export function getStatusLabel(status: ShipmentStatus): string {
  return ShipmentStatusLabels[status] || status;
}

/**
 * Mapeia status da UI para filtrar no backend
 * (inverso do mapToUIStatus)
 */
export function getBackendStatusesForUIFilter(uiStatus: UIShipmentStatus): ShipmentStatus[] {
  switch (uiStatus) {
    case "Aguardando coleta":
      return [
        ShipmentStatus.PICKUP_REQUESTED,
        ShipmentStatus.PICKUP_SCHEDULED,
        ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
      ];

    case "Aguardando postagem":
      return [
        ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
        ShipmentStatus.DROPPED_OFF_AT_POINT,
        ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
      ];

    case "Postado":
      return [
        ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
        ShipmentStatus.IN_TRANSFER,
      ];

    case "Em trânsito":
      return [
        ShipmentStatus.COLLECTED_FROM_SENDER,
        ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
        ShipmentStatus.COLLECTED_FROM_POINT,
        ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
        ShipmentStatus.AT_DESTINATION_HUB,
      ];

    case "Em rota de entrega":
      return [
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
        ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
        ShipmentStatus.DELIVERY_PROBLEM,
      ];

    case "Entregue":
      return [
        ShipmentStatus.DELIVERED,
        ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
      ];

    case "Cancelado":
      return [
        ShipmentStatus.PICKUP_FAILED,
        ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
        ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
        ShipmentStatus.EXPIRED_NOT_POSTED,
        ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
      ];

    case "Devolvido":
      return [
        ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING,
        ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
        ShipmentStatus.RETURNING_TO_SENDER,
        ShipmentStatus.RETURNED_TO_SENDER,
      ];

    default:
      return [];
  }
}
