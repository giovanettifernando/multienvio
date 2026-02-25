/**
 * Derivadora de Estado de Rastreamento dos Correios
 *
 * Deriva o status atual e marcos (milestones) de um shipment baseado na
 * timeline completa de eventos, usando precedência de fases.
 *
 * Precedência (do mais forte ao mais fraco):
 * 1. DELIVERED
 * 2. OUT_FOR_DELIVERY
 * 3. IN_TRANSFER
 * 4. POSTED (RECEIVED_AT_ORIGIN_HUB)
 * 5. AWAITING_DROP_OFF_AT_POINT (PRE_POSTED / Etiqueta emitida)
 */

import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';

// ============================================================================
// Tipos
// ============================================================================

export interface TrackingEventInput {
  codigo?: string | null;
  descricao: string;
  dataHora: Date;
  local?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export interface TrackingMilestones {
  labelCreatedAt: Date | null;
  postedAt: Date | null;
  inTransitAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
}

export interface DerivedTrackingState {
  currentStatus: ShipmentStatus;
  milestones: TrackingMilestones;
  sourceEvent: TrackingEventInput | null;
  phase: TrackingPhase;
  unknownEvents: Array<{ codigo: string | null; descricao: string }>;
}

// Fases ordenadas por precedência (índice maior = mais forte)
export enum TrackingPhase {
  UNKNOWN = 0,
  AWAITING_DROP_OFF = 1,  // Etiqueta emitida, aguardando postagem
  POSTED = 2,             // Objeto postado
  IN_TRANSFER = 3,        // Em trânsito/transferência
  OUT_FOR_DELIVERY = 4,   // Saiu para entrega
  DELIVERED = 5,          // Entregue
  RETURNED = 6,           // Devolvido (caso especial)
  PROBLEM = 7,            // Problema/bloqueio (caso especial)
}

// ============================================================================
// Mapeamento de códigos de evento dos Correios para fase
// ============================================================================

const CODE_TO_PHASE: Record<string, TrackingPhase> = {
  // =========================================
  // Códigos dos Correios (SRO)
  // =========================================

  // Postagem
  'PO': TrackingPhase.POSTED,
  'PMT': TrackingPhase.POSTED,

  // Em trânsito/transferência
  'RO': TrackingPhase.IN_TRANSFER,
  'DO': TrackingPhase.IN_TRANSFER,
  'FC': TrackingPhase.IN_TRANSFER,
  'TRI': TrackingPhase.IN_TRANSFER,
  'CD': TrackingPhase.IN_TRANSFER,
  'BDE': TrackingPhase.IN_TRANSFER,
  'OEC': TrackingPhase.IN_TRANSFER,

  // Saiu para entrega
  'LDI': TrackingPhase.OUT_FOR_DELIVERY,
  'ODS': TrackingPhase.OUT_FOR_DELIVERY,

  // Entregue
  'BDI': TrackingPhase.DELIVERED,

  // Aguardando retirada (tratamos como OUT_FOR_DELIVERY)
  'PAR': TrackingPhase.OUT_FOR_DELIVERY,
  'LDE': TrackingPhase.OUT_FOR_DELIVERY,

  // Problemas
  'BLQ': TrackingPhase.PROBLEM,
  'CMT': TrackingPhase.PROBLEM,

  // Devolução
  'BDR': TrackingPhase.RETURNED,

  // =========================================
  // Códigos da Plataforma (ShipmentStatus)
  // Eventos criados pelo sistema
  // =========================================

  'AWAITING_DROP_OFF_AT_POINT': TrackingPhase.AWAITING_DROP_OFF,
  'RECEIVED_AT_ORIGIN_HUB': TrackingPhase.POSTED,
  'IN_TRANSFER': TrackingPhase.IN_TRANSFER,
  'OUT_FOR_DELIVERY': TrackingPhase.OUT_FOR_DELIVERY,
  'DELIVERED': TrackingPhase.DELIVERED,
  'RETURNED_TO_SENDER': TrackingPhase.RETURNED,
  'DELIVERY_PROBLEM': TrackingPhase.PROBLEM,
  'CANCELLED_BEFORE_HANDOFF': TrackingPhase.PROBLEM,
  'CANCELLED_IN_TRANSIT_RETURNED': TrackingPhase.RETURNED,
  'EXPIRED_NOT_POSTED': TrackingPhase.PROBLEM,
};

// Mapeamento de fase para ShipmentStatus
const PHASE_TO_STATUS: Record<TrackingPhase, ShipmentStatus> = {
  [TrackingPhase.UNKNOWN]: ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
  [TrackingPhase.AWAITING_DROP_OFF]: ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
  [TrackingPhase.POSTED]: ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
  [TrackingPhase.IN_TRANSFER]: ShipmentStatus.IN_TRANSFER,
  [TrackingPhase.OUT_FOR_DELIVERY]: ShipmentStatus.OUT_FOR_DELIVERY,
  [TrackingPhase.DELIVERED]: ShipmentStatus.DELIVERED,
  [TrackingPhase.RETURNED]: ShipmentStatus.RETURNED_TO_SENDER,
  [TrackingPhase.PROBLEM]: ShipmentStatus.DELIVERY_PROBLEM,
};

// ============================================================================
// Funções auxiliares
// ============================================================================

/**
 * Normaliza descrição para comparação
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Determina a fase de um evento baseado em código e/ou descrição
 */
export function getEventPhase(event: TrackingEventInput): TrackingPhase {
  const descNorm = normalizeDescription(event.descricao);

  // ============================================
  // PRIORIDADE 1: Verificar descrições específicas
  // Estas têm precedência sobre o código pois são mais confiáveis
  // ============================================

  // "Etiqueta expirada" => PROBLEM (prazo expirou sem entrega)
  if (descNorm.includes('etiqueta') && descNorm.includes('expirada')) {
    return TrackingPhase.PROBLEM;
  }

  // "Etiqueta emitida" => SEMPRE AWAITING_DROP_OFF
  if (descNorm.includes('etiqueta') && descNorm.includes('emitida')) {
    return TrackingPhase.AWAITING_DROP_OFF;
  }

  // "Objeto postado" (inclui "após o horário limite") => POSTED
  if (descNorm.includes('postado') || descNorm.includes('objeto postado')) {
    return TrackingPhase.POSTED;
  }

  // "Objeto entregue" => DELIVERED
  if (descNorm.includes('entregue') || descNorm.includes('entrega realizada')) {
    return TrackingPhase.DELIVERED;
  }

  // "Saiu para entrega" => OUT_FOR_DELIVERY
  if (descNorm.includes('saiu para entrega') || descNorm.includes('em rota de entrega')) {
    return TrackingPhase.OUT_FOR_DELIVERY;
  }

  // "Objeto em transferência" ou "em trânsito" => IN_TRANSFER
  if (
    descNorm.includes('em transferencia') ||
    descNorm.includes('em transito') ||
    descNorm.includes('por favor aguarde')
  ) {
    return TrackingPhase.IN_TRANSFER;
  }

  // "Devolvido" => RETURNED
  if (descNorm.includes('devolvido ao remetente')) {
    return TrackingPhase.RETURNED;
  }

  // "Em devolução" => RETURNED (em andamento)
  if (descNorm.includes('devolucao') || descNorm.includes('retornando')) {
    return TrackingPhase.RETURNED;
  }

  // ============================================
  // PRIORIDADE 2: Verificar pelo código do evento
  // ============================================
  if (event.codigo) {
    const code = event.codigo.toUpperCase();
    const phaseByCode = CODE_TO_PHASE[code];
    if (phaseByCode !== undefined) {
      return phaseByCode;
    }
  }

  // ============================================
  // PRIORIDADE 3: Fallbacks adicionais por descrição
  // ============================================

  // Aguardando retirada
  if (descNorm.includes('aguardando retirada') || descNorm.includes('disponivel para retirada')) {
    return TrackingPhase.OUT_FOR_DELIVERY;
  }

  // Tentativa de entrega
  if (descNorm.includes('tentativa') || descNorm.includes('ausente') || descNorm.includes('nao entregue')) {
    return TrackingPhase.PROBLEM;
  }

  // Bloqueado
  if (descNorm.includes('bloqueado')) {
    return TrackingPhase.PROBLEM;
  }

  // Encaminhado (genérico, indica movimento)
  if (descNorm.includes('encaminhado')) {
    return TrackingPhase.IN_TRANSFER;
  }

  return TrackingPhase.UNKNOWN;
}

/**
 * Verifica se uma fase é "terminal" (não pode ser superada por fases menores)
 */
function isTerminalPhase(phase: TrackingPhase): boolean {
  return phase === TrackingPhase.DELIVERED || phase === TrackingPhase.RETURNED;
}

// ============================================================================
// Função principal: Derivadora de estado
// ============================================================================

/**
 * Deriva o estado atual de rastreamento baseado na timeline completa de eventos.
 *
 * @param events Lista de eventos ordenada por dataHora (mais antigo primeiro)
 * @returns Estado derivado com status, marcos e evento fonte
 */
export function deriveCorreiosTrackingState(events: TrackingEventInput[]): DerivedTrackingState {
  // Inicializar milestones
  const milestones: TrackingMilestones = {
    labelCreatedAt: null,
    postedAt: null,
    inTransitAt: null,
    outForDeliveryAt: null,
    deliveredAt: null,
  };

  // Eventos desconhecidos para logging
  const unknownEvents: Array<{ codigo: string | null; descricao: string }> = [];

  // Estado atual
  let currentPhase = TrackingPhase.UNKNOWN;
  let sourceEvent: TrackingEventInput | null = null;

  // Ordenar eventos por data (mais antigo primeiro)
  const sortedEvents = [...events].sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());

  // Processar cada evento em ordem cronológica
  for (const event of sortedEvents) {
    const eventPhase = getEventPhase(event);

    // Registrar eventos desconhecidos
    if (eventPhase === TrackingPhase.UNKNOWN) {
      unknownEvents.push({
        codigo: event.codigo || null,
        descricao: event.descricao,
      });
    }

    // Atualizar milestones baseado na fase do evento
    switch (eventPhase) {
      case TrackingPhase.AWAITING_DROP_OFF:
        if (!milestones.labelCreatedAt) {
          milestones.labelCreatedAt = event.dataHora;
        }
        break;

      case TrackingPhase.POSTED:
        if (!milestones.postedAt) {
          milestones.postedAt = event.dataHora;
        }
        break;

      case TrackingPhase.IN_TRANSFER:
        if (!milestones.inTransitAt) {
          milestones.inTransitAt = event.dataHora;
        }
        break;

      case TrackingPhase.OUT_FOR_DELIVERY:
        if (!milestones.outForDeliveryAt) {
          milestones.outForDeliveryAt = event.dataHora;
        }
        break;

      case TrackingPhase.DELIVERED:
        if (!milestones.deliveredAt) {
          milestones.deliveredAt = event.dataHora;
        }
        break;
    }

    // Atualizar fase atual se o evento tem fase maior OU igual
    // (igual = pegar o mais recente da mesma fase, já que eventos estão ordenados)
    // (exceto se já estamos em fase terminal)
    if (!isTerminalPhase(currentPhase)) {
      if (eventPhase >= currentPhase || isTerminalPhase(eventPhase)) {
        currentPhase = eventPhase;
        sourceEvent = event;
      }
    }
  }

  // Se nenhum evento foi processado, assumir AWAITING_DROP_OFF
  if (currentPhase === TrackingPhase.UNKNOWN && sortedEvents.length === 0) {
    currentPhase = TrackingPhase.AWAITING_DROP_OFF;
  }

  // Converter fase para status
  const currentStatus = PHASE_TO_STATUS[currentPhase] || ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;

  return {
    currentStatus,
    milestones,
    sourceEvent,
    phase: currentPhase,
    unknownEvents,
  };
}

// ============================================================================
// Função auxiliar para logging de eventos desconhecidos
// ============================================================================

export function logUnknownEvents(
  trackingCode: string,
  unknownEvents: Array<{ codigo: string | null; descricao: string }>
): void {
  if (unknownEvents.length === 0) {
    return;
  }

  console.warn(`[TRACKING_DERIVADOR] Eventos desconhecidos para ${trackingCode}:`, unknownEvents);
}
