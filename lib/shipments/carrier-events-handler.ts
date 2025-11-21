/**
 * Handler centralizado para eventos de rastreio de transportadoras
 * Mapeia eventos de diferentes carriers (Correios, Jadlog, etc.) para ShipmentStatus
 */

import { ShipmentStatus } from './shipment-status';
import { prisma } from '@/lib/db';

/**
 * Tipo de evento de transportadora
 */
export interface CarrierEvent {
  /** Código do evento da transportadora (ex: "BDE", "OEC", etc.) */
  eventCode: string;
  /** Descrição do evento em português */
  description: string;
  /** Data/hora do evento */
  occurredAt: Date;
  /** Localização onde ocorreu o evento */
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  /** Transportadora de origem (correios, jadlog, etc.) */
  carrier: string;
  /** Observações adicionais */
  notes?: string;
}

/**
 * Mapeamento de códigos/descrições de eventos para ShipmentStatus
 *
 * Cada transportadora pode ter códigos diferentes, mas a descrição normalizada
 * é usada como fallback para mapear corretamente
 */
const EVENT_TO_STATUS_MAP: Record<string, ShipmentStatus> = {
  // CORREIOS - Códigos de evento
  'BDE': ShipmentStatus.IN_TRANSFER, // Transferência
  'CD': ShipmentStatus.IN_TRANSFER, // Em trânsito
  'OEC': ShipmentStatus.IN_TRANSIT_TO_DESTINATION, // Objeto encaminhado
  'DO': ShipmentStatus.AT_DESTINATION_HUB, // Objeto chegou à unidade de destino
  'ODS': ShipmentStatus.OUT_FOR_DELIVERY, // Saiu para entrega
  'BDI': ShipmentStatus.DELIVERED, // Entregue
  'BDE-DELIVERED': ShipmentStatus.DELIVERED, // Entregue
  'PAR': ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB, // Aguardando retirada
  'TF': ShipmentStatus.DELIVERY_ATTEMPT_FAILED, // Tentativa de entrega falhou
  'LDI': ShipmentStatus.DELIVERY_PROBLEM, // Objeto com problema de entrega
  'RO': ShipmentStatus.RETURNING_TO_SENDER, // Devolvendo
  'BDR': ShipmentStatus.RETURNED_TO_SENDER, // Devolvido

  // JADLOG - Códigos de evento
  'EMTRANSFERENCIA': ShipmentStatus.IN_TRANSFER,
  'EMTRANSITO': ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  'SAIUPARAENTREGA': ShipmentStatus.OUT_FOR_DELIVERY,
  'ENTREGUE': ShipmentStatus.DELIVERED,
  'TENTATIVAFALHOU': ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
  'PROBLEMA': ShipmentStatus.DELIVERY_PROBLEM,
  'DEVOLVENDO': ShipmentStatus.RETURNING_TO_SENDER,
  'DEVOLVIDO': ShipmentStatus.RETURNED_TO_SENDER,

  // Normalização por descrição (fallback)
  'em transferencia': ShipmentStatus.IN_TRANSFER,
  'em transito': ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  'em rota de entrega': ShipmentStatus.OUT_FOR_DELIVERY,
  'saiu para entrega': ShipmentStatus.OUT_FOR_DELIVERY,
  'entregue': ShipmentStatus.DELIVERED,
  'tentativa de entrega': ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
  'entrega nao realizada': ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
  'problema na entrega': ShipmentStatus.DELIVERY_PROBLEM,
  'aguardando retirada': ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
  'disponivel para retirada': ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
  'devolvendo': ShipmentStatus.RETURNING_TO_SENDER,
  'em devolucao': ShipmentStatus.RETURNING_TO_SENDER,
  'devolvido': ShipmentStatus.RETURNED_TO_SENDER,
  'devolucao concluida': ShipmentStatus.RETURNED_TO_SENDER,
};

/**
 * Mapeia um evento de transportadora para um ShipmentStatus
 *
 * Tenta primeiro pelo código do evento, depois pela descrição normalizada
 */
export function mapCarrierEventToShipmentStatus(event: CarrierEvent): ShipmentStatus | null {
  // Tentar mapear pelo código do evento
  const statusByCode = EVENT_TO_STATUS_MAP[event.eventCode.toUpperCase()];
  if (statusByCode) {
    return statusByCode;
  }

  // Tentar mapear pela descrição normalizada (lowercase, sem acentos)
  const normalizedDescription = event.description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

  const statusByDescription = EVENT_TO_STATUS_MAP[normalizedDescription];
  if (statusByDescription) {
    return statusByDescription;
  }

  // Fallback: tentar palavras-chave na descrição
  if (normalizedDescription.includes('entregue') || normalizedDescription.includes('entrega realizada')) {
    return ShipmentStatus.DELIVERED;
  }

  if (normalizedDescription.includes('saiu para entrega') || normalizedDescription.includes('rota de entrega')) {
    return ShipmentStatus.OUT_FOR_DELIVERY;
  }

  if (normalizedDescription.includes('transferencia')) {
    return ShipmentStatus.IN_TRANSFER;
  }

  if (normalizedDescription.includes('transito')) {
    return ShipmentStatus.IN_TRANSIT_TO_DESTINATION;
  }

  if (normalizedDescription.includes('tentativa') && normalizedDescription.includes('falhou')) {
    return ShipmentStatus.DELIVERY_ATTEMPT_FAILED;
  }

  if (normalizedDescription.includes('problema')) {
    return ShipmentStatus.DELIVERY_PROBLEM;
  }

  if (normalizedDescription.includes('devol')) {
    if (normalizedDescription.includes('concluida') || normalizedDescription.includes('devolvido')) {
      return ShipmentStatus.RETURNED_TO_SENDER;
    }
    return ShipmentStatus.RETURNING_TO_SENDER;
  }

  if (normalizedDescription.includes('aguardando retirada') || normalizedDescription.includes('disponivel para retirada')) {
    return ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB;
  }

  // Não conseguiu mapear
  console.warn('[CARRIER_EVENT_MAPPING] Evento não mapeado:', {
    eventCode: event.eventCode,
    description: event.description,
    carrier: event.carrier,
  });

  return null;
}

/**
 * Aplica um evento de transportadora a um shipment
 * Atualiza o status do shipment e registra o evento no histórico
 *
 * @param shipmentId ID do shipment
 * @param event Evento da transportadora
 * @returns Shipment atualizado ou null se não foi possível aplicar
 */
export async function applyCarrierEventToShipment(
  shipmentId: string,
  event: CarrierEvent
): Promise<{ success: boolean; newStatus?: ShipmentStatus; message: string }> {
  try {
    // Mapear evento para status
    const newStatus = mapCarrierEventToShipmentStatus(event);

    if (!newStatus) {
      return {
        success: false,
        message: `Evento não mapeado: ${event.eventCode} - ${event.description}`,
      };
    }

    // Buscar shipment atual
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        platformTrackingCode: true,
      },
    });

    if (!shipment) {
      return {
        success: false,
        message: 'Shipment não encontrado',
      };
    }

    // Verificar se o novo status é diferente do atual (evita updates desnecessários)
    if (shipment.status === newStatus) {
      console.log('[CARRIER_EVENT] Status já está atualizado:', {
        shipmentId,
        currentStatus: shipment.status,
        eventStatus: newStatus,
      });

      return {
        success: true,
        newStatus,
        message: 'Status já atualizado (sem mudança)',
      };
    }

    // Atualizar shipment em uma transação
    await prisma.$transaction(async (tx) => {
      // 1. Atualizar status do shipment
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: newStatus,
        },
      });

      // 2. Registrar evento no histórico de tracking
      await tx.trackingEvent.create({
        data: {
          shipmentId,
          type: newStatus,
          description: event.description,
          city: event.location?.city || null,
          uf: event.location?.state || null,
          occurredAt: event.occurredAt,
        },
      });
    });

    console.log('[CARRIER_EVENT] Status atualizado:', {
      shipmentId,
      trackingCode: shipment.platformTrackingCode,
      oldStatus: shipment.status,
      newStatus,
      eventCode: event.eventCode,
      eventDescription: event.description,
      carrier: event.carrier,
      occurredAt: event.occurredAt,
    });

    return {
      success: true,
      newStatus,
      message: `Status atualizado: ${shipment.status} → ${newStatus}`,
    };
  } catch (error) {
    console.error('[CARRIER_EVENT_ERROR]', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao aplicar evento',
    };
  }
}

/**
 * Processa múltiplos eventos de uma vez (batch)
 * Útil quando recebe webhook com múltiplos eventos
 */
export async function applyCarrierEventsBatch(
  events: Array<{ shipmentId: string; event: CarrierEvent }>
): Promise<Array<{ shipmentId: string; success: boolean; message: string }>> {
  const results = [];

  for (const { shipmentId, event } of events) {
    const result = await applyCarrierEventToShipment(shipmentId, event);
    results.push({
      shipmentId,
      success: result.success,
      message: result.message,
    });
  }

  return results;
}

/**
 * Helper: Normaliza código de evento de transportadora
 * Remove espaços, converte para uppercase
 */
export function normalizeEventCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Helper: Valida se um evento de transportadora é válido
 */
export function validateCarrierEvent(event: Partial<CarrierEvent>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!event.eventCode || event.eventCode.trim() === '') {
    errors.push('eventCode é obrigatório');
  }

  if (!event.description || event.description.trim() === '') {
    errors.push('description é obrigatório');
  }

  if (!event.occurredAt || !(event.occurredAt instanceof Date)) {
    errors.push('occurredAt deve ser uma data válida');
  }

  if (!event.carrier || event.carrier.trim() === '') {
    errors.push('carrier é obrigatório');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
