/**
 * Serviço de Sincronização de Rastreamento Loggi
 *
 * Consulta a API de tracking da Loggi e sincroniza eventos com o banco.
 * Similar ao sync-correios, mas adaptado para o formato de resposta da Loggi.
 */

import { prisma } from '@/platform/db/db';
import { getLoggiTracking } from '@/platform/integrations/loggi';
import type { LoggiTrackingStatus } from '@/platform/integrations/loggi';
import { logger } from '@/platform/logging/logger';

// ============================================================================
// Tipos
// ============================================================================

export interface SyncLoggiTrackingResult {
  success: boolean;
  shipmentId?: string;
  trackingCode: string;
  message: string;
  eventsAdded: number;
  statusUpdated: boolean;
  milestonesUpdated: string[];
  newStatus?: string;
  previousStatus?: string;
}

// ============================================================================
// Mapeamento de status Loggi → status interno
// ============================================================================

/**
 * Mapeia highLevelStatus da Loggi para status do Shipment no banco.
 *
 * Valores conhecidos da Loggi:
 * - ALLOCATED / READY_FOR_PICKUP → aguardando coleta
 * - COLLECTED / PICKED_UP → coletado
 * - IN_TRANSIT / HANDLING → em trânsito
 * - OUT_FOR_DELIVERY / LAST_MILE → saiu para entrega
 * - DELIVERED → entregue
 * - RETURNING / RETURNED → devolvido
 * - CANCELLED → cancelado
 * - DELIVERY_FAILED → problema na entrega
 */
function mapLoggiStatus(highLevelStatus: string): string {
  const normalized = highLevelStatus.toUpperCase().replace(/[-\s]/g, '_');

  switch (normalized) {
    case 'ALLOCATED':
    case 'READY_FOR_PICKUP':
    case 'CREATED':
    case 'ORDER_CREATED':
      return 'AWAITING_DROP_OFF_AT_POINT';

    case 'COLLECTED':
    case 'PICKED_UP':
    case 'PICKUP_DONE':
      return 'RECEIVED_AT_ORIGIN_HUB';

    case 'IN_TRANSIT':
    case 'HANDLING':
    case 'HUB_TRANSFER':
    case 'SORTING':
      return 'IN_TRANSFER';

    case 'OUT_FOR_DELIVERY':
    case 'LAST_MILE':
    case 'ON_ROUTE':
      return 'OUT_FOR_DELIVERY';

    case 'DELIVERED':
    case 'DELIVERY_DONE':
      return 'DELIVERED';

    case 'RETURNING':
    case 'RETURNED':
    case 'RETURN_IN_TRANSIT':
    case 'RETURN_COMPLETED':
      return 'RETURNED_TO_SENDER';

    case 'DELIVERY_FAILED':
    case 'DELIVERY_ATTEMPT_FAILED':
    case 'DELIVERY_PROBLEM':
      return 'DELIVERY_PROBLEM';

    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED_IN_TRANSIT_RETURNED';

    default:
      logger.warn({
        event: 'loggi_unknown_status',
        highLevelStatus,
      }, 'Unknown Loggi tracking status');
      return 'IN_TRANSFER'; // Default conservador
  }
}

/**
 * Mapeia status Loggi para tipo de evento de tracking
 */
function mapLoggiEventType(highLevelStatus: string): string {
  const status = mapLoggiStatus(highLevelStatus);
  return status; // Usar o mesmo mapeamento para tipo de evento
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Gera chave única para deduplicação de eventos
 */
function generateEventKey(description: string, city: string | null | undefined, date: Date): string {
  const dateOnly = date.toISOString().split('T')[0];
  const normalizedDesc = description.toLowerCase().trim();
  const normalizedCity = (city || '').toLowerCase().trim();
  return `${normalizedDesc}|${normalizedCity}|${dateOnly}`;
}

// ============================================================================
// Função principal
// ============================================================================

/**
 * Sincroniza rastreamento de um envio Loggi pelo tracking code
 */
export async function syncLoggiTracking(trackingCode: string): Promise<SyncLoggiTrackingResult> {
  const code = trackingCode.trim();

  logger.info({
    event: 'loggi_sync_tracking_start',
    trackingCode: code,
  }, 'Starting Loggi tracking sync');

  // 1. Buscar shipment pelo código
  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        { carrierTrackingCode: code },
        { platformTrackingCode: code },
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
          description: true,
          city: true,
          occurredAt: true,
        },
      },
    },
  });

  if (!shipment) {
    return {
      success: false,
      trackingCode: code,
      message: `Shipment não encontrado para o código ${code}`,
      eventsAdded: 0,
      statusUpdated: false,
      milestonesUpdated: [],
    };
  }

  const carrierCode = shipment.carrierTrackingCode || code;

  // 2. Consultar API da Loggi
  let trackingResponse;
  try {
    trackingResponse = await getLoggiTracking(carrierCode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    logger.error({
      event: 'loggi_tracking_api_error',
      trackingCode: carrierCode,
      error: msg,
    }, 'Loggi tracking API error');

    return {
      success: false,
      shipmentId: shipment.id,
      trackingCode: carrierCode,
      message: `Erro ao consultar API Loggi: ${msg}`,
      eventsAdded: 0,
      statusUpdated: false,
      milestonesUpdated: [],
    };
  }

  const packages = trackingResponse.packages;
  if (!packages || packages.length === 0) {
    return {
      success: false,
      shipmentId: shipment.id,
      trackingCode: carrierCode,
      message: 'Nenhum pacote encontrado na resposta da Loggi',
      eventsAdded: 0,
      statusUpdated: false,
      milestonesUpdated: [],
    };
  }

  // Usar o primeiro pacote (geralmente 1 pacote por tracking code)
  const pkg = packages[0];
  const history = pkg.trackingHistory || [];

  if (history.length === 0 && !pkg.status) {
    return {
      success: true,
      shipmentId: shipment.id,
      trackingCode: carrierCode,
      message: 'Nenhum evento de rastreio disponível',
      eventsAdded: 0,
      statusUpdated: false,
      milestonesUpdated: [],
    };
  }

  // 3. Construir lista completa de eventos (histórico + status atual)
  const allLoggiEvents: LoggiTrackingStatus[] = [...history];
  if (pkg.status && !history.some((h) => h.updatedTime === pkg.status.updatedTime && h.description === pkg.status.description)) {
    allLoggiEvents.push(pkg.status);
  }

  // Ordenar por data
  allLoggiEvents.sort((a, b) =>
    new Date(a.updatedTime).getTime() - new Date(b.updatedTime).getTime()
  );

  // 4. Deduplicar contra eventos existentes no banco
  const existingKeys = new Set(
    shipment.trackingEvents.map((e) =>
      generateEventKey(e.description, e.city, e.occurredAt)
    )
  );

  const newEvents = allLoggiEvents.filter((evt) => {
    const eventDate = new Date(evt.updatedTime);
    const city = pkg.location?.city || null;
    const key = generateEventKey(evt.description, city, eventDate);
    return !existingKeys.has(key);
  });

  // 5. Determinar novo status baseado no status atual da Loggi
  const currentLoggiStatus = pkg.status?.highLevelStatus;
  const newStatus = currentLoggiStatus ? mapLoggiStatus(currentLoggiStatus) : null;
  const previousStatus = shipment.status;
  const statusChanged = newStatus !== null && newStatus !== previousStatus;

  // 6. Determinar milestones
  const milestonesUpdated: string[] = [];
  const milestonesToUpdate: Record<string, Date> = {};

  // postedAt → quando foi coletado
  if (!shipment.postedAt) {
    const collectedEvent = allLoggiEvents.find((e) => {
      const mapped = mapLoggiStatus(e.highLevelStatus);
      return mapped === 'RECEIVED_AT_ORIGIN_HUB' || mapped === 'IN_TRANSFER';
    });
    if (collectedEvent) {
      milestonesToUpdate.postedAt = new Date(collectedEvent.updatedTime);
      milestonesUpdated.push('postedAt');
    }
  }

  // deliveredAt → quando foi entregue
  if (!shipment.deliveredAt) {
    const deliveredEvent = allLoggiEvents.find((e) =>
      mapLoggiStatus(e.highLevelStatus) === 'DELIVERED'
    );
    if (deliveredEvent) {
      milestonesToUpdate.deliveredAt = new Date(deliveredEvent.updatedTime);
      milestonesUpdated.push('deliveredAt');
    }
  }

  // 7. Persistir em transação
  let eventsAdded = 0;
  let statusUpdated = false;

  await prisma.$transaction(async (tx) => {
    // Inserir novos eventos
    for (const evt of newEvents) {
      const eventDate = new Date(evt.updatedTime);
      const eventType = mapLoggiEventType(evt.highLevelStatus);

      await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          type: eventType,
          description: evt.description,
          city: pkg.location?.city || null,
          uf: pkg.location?.state || null,
          occurredAt: eventDate,
        },
      });
      eventsAdded++;
    }

    // Atualizar shipment
    const updateData: Record<string, unknown> = {};

    if (statusChanged && newStatus) {
      updateData.status = newStatus;
      statusUpdated = true;
    }

    for (const [key, value] of Object.entries(milestonesToUpdate)) {
      updateData[key] = value;
    }

    if (Object.keys(updateData).length > 0) {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: updateData,
      });
    }
  });

  logger.info({
    event: 'loggi_sync_tracking_complete',
    trackingCode: carrierCode,
    shipmentId: shipment.id,
    eventsAdded,
    statusUpdated,
    milestonesUpdated,
    newStatus,
    previousStatus,
  }, 'Loggi tracking sync completed');

  return {
    success: true,
    shipmentId: shipment.id,
    trackingCode: carrierCode,
    message: eventsAdded > 0 || statusUpdated || milestonesUpdated.length > 0
      ? `Sincronização concluída: ${eventsAdded} evento(s)${statusUpdated ? ', status atualizado' : ''}${milestonesUpdated.length > 0 ? `, milestones: ${milestonesUpdated.join(', ')}` : ''}`
      : 'Nenhuma atualização necessária',
    eventsAdded,
    statusUpdated,
    milestonesUpdated,
    newStatus: newStatus || undefined,
    previousStatus,
  };
}
