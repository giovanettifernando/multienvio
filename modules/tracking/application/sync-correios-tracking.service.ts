/**
 * Serviço de Sincronização de Rastreamento dos Correios
 *
 * Sincroniza eventos de rastreamento da API dos Correios com os shipments no banco.
 * Usa a derivadora de estado para determinar status e marcos (milestones) de forma
 * determinística baseada na timeline completa de eventos.
 */

import { prisma } from '@/platform/db/db';
import { rastrearObjeto } from '@/platform/integrations/correios/rastro';
import { logger } from '@/platform/logging/logger';
import {
  deriveCorreiosTrackingState,
  getEventPhase,
  logUnknownEvents,
  type TrackingEventInput,
  type DerivedTrackingState,
} from './derive-tracking-state';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Resultado da sincronização
 */
export interface SyncTrackingResult {
  success: boolean;
  shipmentId?: string;
  trackingCode: string;
  message: string;
  eventsAdded: number;
  statusUpdated: boolean;
  milestonesUpdated: string[];
  newStatus?: string;
  previousStatus?: string;
  derivedState?: DerivedTrackingState;
  events?: Array<{
    dataHora: Date;
    descricao: string;
    local?: string;
    cidade?: string;
    uf?: string;
    isNew: boolean;
  }>;
}

// ============================================================================
// Funções auxiliares
// ============================================================================

/**
 * Gera chave única para um evento (para detectar duplicatas)
 * Usa descrição + cidade + data (sem hora) para evitar duplicatas por timezone
 */
function generateEventKey(description: string, city: string | null | undefined, date: Date): string {
  const dateOnly = date.toISOString().split('T')[0]; // Apenas YYYY-MM-DD
  const normalizedDesc = description.toLowerCase().trim();
  const normalizedCity = (city || '').toLowerCase().trim();
  return `${normalizedDesc}|${normalizedCity}|${dateOnly}`;
}

/**
 * Converte evento da API dos Correios para formato da derivadora
 */
function toDerivadoraEvent(evento: {
  codigo: string;
  descricao: string;
  dataHora: Date;
  local?: string;
  cidade?: string;
  uf?: string;
}): TrackingEventInput {
  return {
    codigo: evento.codigo || null,
    descricao: evento.descricao,
    dataHora: evento.dataHora,
    local: evento.local || null,
    cidade: evento.cidade || null,
    uf: evento.uf || null,
  };
}

/**
 * Converte evento do banco para formato da derivadora
 */
function dbEventToDerivadoraEvent(event: {
  type: string;
  description: string;
  city: string | null;
  uf?: string | null;
  occurredAt: Date;
}): TrackingEventInput {
  return {
    codigo: event.type, // type no banco é o código/status
    descricao: event.description,
    dataHora: event.occurredAt,
    cidade: event.city,
    uf: event.uf || null,
  };
}

// ============================================================================
// Função principal de sincronização
// ============================================================================

/**
 * Sincroniza rastreamento de um shipment específico pelo código de rastreio da transportadora
 *
 * @param carrierTrackingCode Código de rastreio dos Correios (SRO)
 */
export async function syncCorreiosTracking(carrierTrackingCode: string): Promise<SyncTrackingResult> {
  const trackingCode = carrierTrackingCode.trim().toUpperCase();

  logger.info({
    event: 'correios_sync_tracking_start',
    trackingCode,
  }, 'Starting Correios tracking sync');

  // 1. Buscar shipment pelo código de rastreio
  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        { carrierTrackingCode: trackingCode },
        { platformTrackingCode: trackingCode },
      ],
    },
    select: {
      id: true,
      status: true,
      carrierTrackingCode: true,
      platformTrackingCode: true,
      postedAt: true,
      deliveredAt: true,
      trackingEvents: {
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          type: true,
          description: true,
          city: true,
          uf: true,
          occurredAt: true,
        },
      },
    },
  });

  if (!shipment) {
    return {
      success: false,
      trackingCode,
      message: `Shipment não encontrado para o código ${trackingCode}`,
      eventsAdded: 0,
      statusUpdated: false,
      milestonesUpdated: [],
    };
  }

  // Se não tem código de rastreio dos correios, não dá pra sincronizar
  const sroCode = shipment.carrierTrackingCode;
  if (!sroCode) {
    return {
      success: false,
      shipmentId: shipment.id,
      trackingCode,
      message: 'Shipment não possui código de rastreio dos Correios',
      eventsAdded: 0,
      statusUpdated: false,
      milestonesUpdated: [],
    };
  }

  // 2. Consultar API dos Correios
  const rastreio = await rastrearObjeto(sroCode);

  if (!rastreio.eventos || rastreio.eventos.length === 0) {
    return {
      success: false,
      shipmentId: shipment.id,
      trackingCode: sroCode,
      message: rastreio.mensagem || 'Nenhum evento de rastreio encontrado',
      eventsAdded: 0,
      statusUpdated: false,
      milestonesUpdated: [],
    };
  }

  // 3. Identificar eventos existentes (para evitar duplicatas)
  const existingEventKeys = new Set(
    shipment.trackingEvents.map((e) =>
      generateEventKey(e.description, e.city, e.occurredAt)
    )
  );

  // Filtrar eventos novos da API
  const newApiEvents = rastreio.eventos.filter((e) => {
    const key = generateEventKey(e.descricao, e.cidade, e.dataHora);
    return !existingEventKeys.has(key);
  });

  // 4. Construir timeline completa (eventos do banco + novos da API)
  const allEvents: TrackingEventInput[] = [
    // Eventos existentes no banco
    ...shipment.trackingEvents.map(dbEventToDerivadoraEvent),
    // Novos eventos da API
    ...newApiEvents.map(toDerivadoraEvent),
  ];

  // 5. Derivar estado usando a derivadora
  const derivedState = deriveCorreiosTrackingState(allEvents);

  // Log eventos desconhecidos para mapeamento futuro
  if (derivedState.unknownEvents.length > 0) {
    logUnknownEvents(sroCode, derivedState.unknownEvents);
    logger.warn({
      event: 'correios_unknown_events',
      trackingCode: sroCode,
      unknownEvents: derivedState.unknownEvents,
    }, 'Unknown Correios events detected');
  }

  // 6. Determinar o que precisa ser atualizado
  const previousStatus = shipment.status;
  const newStatus = derivedState.currentStatus;
  const statusChanged = newStatus !== previousStatus;

  // Determinar quais milestones precisam ser atualizados
  const milestonesUpdated: string[] = [];
  const milestonesToUpdate: Record<string, Date | null> = {};

  // postedAt
  if (derivedState.milestones.postedAt && !shipment.postedAt) {
    milestonesToUpdate.postedAt = derivedState.milestones.postedAt;
    milestonesUpdated.push('postedAt');
  }

  // deliveredAt
  if (derivedState.milestones.deliveredAt && !shipment.deliveredAt) {
    milestonesToUpdate.deliveredAt = derivedState.milestones.deliveredAt;
    milestonesUpdated.push('deliveredAt');
  }

  // 7. Atualizar banco em uma transação
  let eventsAdded = 0;
  let statusUpdated = false;

  await prisma.$transaction(async (tx) => {
    // Adicionar novos eventos
    for (const evento of newApiEvents) {
      // Usar a derivadora para determinar o tipo do evento
      const eventInput = toDerivadoraEvent(evento);
      const eventPhase = getEventPhase(eventInput);

      // Converter fase para tipo de evento (string para o banco)
      // A fase é mapeada para o status correspondente
      const phaseToType: Record<number, string> = {
        0: 'UNKNOWN',
        1: 'AWAITING_DROP_OFF_AT_POINT',
        2: 'RECEIVED_AT_ORIGIN_HUB',
        3: 'IN_TRANSFER',
        4: 'OUT_FOR_DELIVERY',
        5: 'DELIVERED',
        6: 'RETURNED_TO_SENDER',
        7: 'DELIVERY_PROBLEM',
      };
      const eventType = phaseToType[eventPhase] || 'CORREIOS_EVENT';

      await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          type: eventType,
          description: evento.descricao,
          city: evento.cidade || null,
          uf: evento.uf || null,
          occurredAt: evento.dataHora,
        },
      });
      eventsAdded++;
    }

    // Atualizar shipment se necessário
    const updateData: Record<string, unknown> = {};

    // Atualizar status se mudou
    if (statusChanged) {
      updateData.status = newStatus;
      statusUpdated = true;
    }

    // Atualizar milestones
    for (const [key, value] of Object.entries(milestonesToUpdate)) {
      if (value) {
        updateData[key] = value;
      }
    }

    // Executar update se há algo a atualizar
    if (Object.keys(updateData).length > 0) {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: updateData,
      });
    }
  });

  logger.info({
    event: 'correios_sync_tracking_complete',
    trackingCode: sroCode,
    shipmentId: shipment.id,
    eventsAdded,
    statusUpdated,
    milestonesUpdated,
    newStatus,
    previousStatus,
    phase: derivedState.phase,
  }, 'Correios tracking sync completed');

  return {
    success: true,
    shipmentId: shipment.id,
    trackingCode: sroCode,
    message: eventsAdded > 0 || statusUpdated || milestonesUpdated.length > 0
      ? `Sincronização concluída: ${eventsAdded} evento(s) adicionado(s)${statusUpdated ? ', status atualizado' : ''}${milestonesUpdated.length > 0 ? `, milestones: ${milestonesUpdated.join(', ')}` : ''}`
      : 'Nenhuma atualização necessária (já sincronizado)',
    eventsAdded,
    statusUpdated,
    milestonesUpdated,
    newStatus: newStatus || undefined,
    previousStatus,
    derivedState,
    events: rastreio.eventos.map((e) => ({
      dataHora: e.dataHora,
      descricao: e.descricao,
      local: e.local,
      cidade: e.cidade,
      uf: e.uf,
      isNew: !existingEventKeys.has(generateEventKey(e.descricao, e.cidade, e.dataHora)),
    })),
  };
}

// ============================================================================
// Funções auxiliares de sincronização em lote
// ============================================================================

/**
 * Sincroniza rastreamento de múltiplos shipments
 * Útil para sincronização em lote
 *
 * @param trackingCodes Array de códigos de rastreio
 */
export async function syncCorreiosTrackingBatch(
  trackingCodes: string[]
): Promise<SyncTrackingResult[]> {
  const results: SyncTrackingResult[] = [];

  for (const code of trackingCodes) {
    try {
      const result = await syncCorreiosTracking(code);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        trackingCode: code,
        message: error instanceof Error ? error.message : 'Erro ao sincronizar',
        eventsAdded: 0,
        statusUpdated: false,
        milestonesUpdated: [],
      });
    }
  }

  return results;
}

/**
 * Sincroniza todos os shipments pendentes dos Correios
 * Busca shipments que estão em trânsito e ainda não foram entregues
 */
export async function syncAllPendingCorreiosShipments(): Promise<{
  total: number;
  synced: number;
  failed: number;
  results: SyncTrackingResult[];
}> {
  // Buscar shipments dos Correios que ainda não foram entregues
  const pendingShipments = await prisma.shipment.findMany({
    where: {
      carrierTrackingCode: { not: null },
      status: {
        notIn: [
          'DELIVERED',
          'RETURNED_TO_SENDER',
          'CANCELLED_BEFORE_HANDOFF',
          'CANCELLED_IN_TRANSIT_RETURNED',
          'EXPIRED_NOT_POSTED',
        ],
      },
      // Apenas envios dos Correios (código termina com BR)
      AND: {
        carrierTrackingCode: { endsWith: 'BR' },
      },
    },
    select: {
      carrierTrackingCode: true,
    },
    take: 50, // Limitar para evitar sobrecarga
  });

  const trackingCodes = pendingShipments
    .map((s) => s.carrierTrackingCode)
    .filter((code): code is string => code !== null);

  const results = await syncCorreiosTrackingBatch(trackingCodes);

  return {
    total: trackingCodes.length,
    synced: results.filter((r) => r.success && (r.eventsAdded > 0 || r.statusUpdated)).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
