/**
 * Serviço de Sincronização de Rastreamento dos Correios
 *
 * Sincroniza eventos de rastreamento da API dos Correios com os shipments no banco.
 * Usado quando webhooks não estão disponíveis ou para forçar atualização manual.
 */

import { prisma } from '@/platform/db/db';
import { rastrearObjeto } from '@/platform/integrations/correios/rastro';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { logger } from '@/platform/logging/logger';

/**
 * Mapeamento de códigos de evento dos Correios para ShipmentStatus
 */
const CORREIOS_EVENT_TO_STATUS: Record<string, ShipmentStatus> = {
  // Postagem
  'PO': ShipmentStatus.RECEIVED_AT_ORIGIN_HUB, // Objeto postado

  // Em trânsito
  'RO': ShipmentStatus.IN_TRANSFER, // Objeto em trânsito (recebido na unidade)
  'DO': ShipmentStatus.IN_TRANSFER, // Objeto em trânsito (distribuição)
  'BDE': ShipmentStatus.IN_TRANSFER, // Objeto encaminhado
  'FC': ShipmentStatus.IN_TRANSFER, // Objeto em trânsito
  'TRI': ShipmentStatus.IN_TRANSFER, // Objeto em trânsito
  'CD': ShipmentStatus.IN_TRANSFER, // Objeto em trânsito

  // Em transito para destino
  'OEC': ShipmentStatus.IN_TRANSIT_TO_DESTINATION, // Objeto encaminhado para destino

  // Saiu para entrega
  'LDI': ShipmentStatus.OUT_FOR_DELIVERY, // Objeto saiu para entrega
  'ODS': ShipmentStatus.OUT_FOR_DELIVERY, // Objeto saiu para entrega ao destinatário

  // Entrega
  'BDI': ShipmentStatus.DELIVERED, // Objeto entregue ao destinatário
  'BDE-DELIVERED': ShipmentStatus.DELIVERED, // Entregue

  // Aguardando retirada
  'PAR': ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB, // Aguardando retirada
  'LDE': ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB, // Disponível em locker

  // Tentativa de entrega falhou
  'BLQ': ShipmentStatus.DELIVERY_ATTEMPT_FAILED, // Objeto bloqueado
  'CMT': ShipmentStatus.DELIVERY_ATTEMPT_FAILED, // Saiu para entrega (pode indicar problema)

  // Devolução
  'PMT': ShipmentStatus.RETURNING_TO_SENDER, // Objeto em devolução
  'BDR': ShipmentStatus.RETURNED_TO_SENDER, // Objeto devolvido ao remetente
};

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
  newStatus?: string;
  previousStatus?: string;
  events?: Array<{
    dataHora: Date;
    descricao: string;
    local?: string;
    cidade?: string;
    uf?: string;
    isNew: boolean;
  }>;
}

/**
 * Mapeia código de evento dos Correios para ShipmentStatus
 * Tenta pelo código primeiro, depois por palavras-chave na descrição
 */
function mapCorreiosEventToStatus(eventCode: string, description: string): ShipmentStatus | null {
  // Tentar mapear pelo código
  const statusByCode = CORREIOS_EVENT_TO_STATUS[eventCode.toUpperCase()];
  if (statusByCode) {
    return statusByCode;
  }

  // Normalizar descrição para busca por palavras-chave
  const descNorm = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Mapeamento por palavras-chave na descrição
  if (descNorm.includes('entregue') || descNorm.includes('entrega realizada')) {
    return ShipmentStatus.DELIVERED;
  }

  if (descNorm.includes('saiu para entrega') || descNorm.includes('em rota de entrega')) {
    return ShipmentStatus.OUT_FOR_DELIVERY;
  }

  if (descNorm.includes('objeto em transferencia') || descNorm.includes('encaminhado')) {
    return ShipmentStatus.IN_TRANSFER;
  }

  if (descNorm.includes('em transito') || descNorm.includes('por favor aguarde')) {
    return ShipmentStatus.IN_TRANSIT_TO_DESTINATION;
  }

  if (descNorm.includes('postado') || descNorm.includes('postagem')) {
    return ShipmentStatus.RECEIVED_AT_ORIGIN_HUB;
  }

  if (descNorm.includes('aguardando retirada') || descNorm.includes('disponivel para retirada')) {
    return ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB;
  }

  if (descNorm.includes('tentativa') || descNorm.includes('ausente') || descNorm.includes('nao entregue')) {
    return ShipmentStatus.DELIVERY_ATTEMPT_FAILED;
  }

  if (descNorm.includes('devolv') || descNorm.includes('retorn')) {
    if (descNorm.includes('ao remetente') || descNorm.includes('concluida')) {
      return ShipmentStatus.RETURNED_TO_SENDER;
    }
    return ShipmentStatus.RETURNING_TO_SENDER;
  }

  // Fallback: se menciona etiqueta emitida, é aguardando postagem
  if (descNorm.includes('etiqueta') && descNorm.includes('emitida')) {
    return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
  }

  return null;
}

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
      deliveredAt: true,
      trackingEvents: {
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          type: true,
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
      trackingCode,
      message: `Shipment não encontrado para o código ${trackingCode}`,
      eventsAdded: 0,
      statusUpdated: false,
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
    };
  }

  // 3. Encontrar eventos que ainda não existem no banco
  // Usar chave composta: descrição + cidade + data (sem hora) para evitar duplicatas por timezone
  const generateEventKey = (description: string, city: string | null | undefined, date: Date) => {
    const dateOnly = date.toISOString().split('T')[0]; // Apenas YYYY-MM-DD
    const normalizedDesc = description.toLowerCase().trim();
    const normalizedCity = (city || '').toLowerCase().trim();
    return `${normalizedDesc}|${normalizedCity}|${dateOnly}`;
  };

  const existingEventKeys = new Set(
    shipment.trackingEvents.map((e) =>
      generateEventKey(e.description, e.city, e.occurredAt)
    )
  );

  const newEvents = rastreio.eventos.filter((e) => {
    const key = generateEventKey(e.descricao, e.cidade, e.dataHora);
    return !existingEventKeys.has(key);
  });

  // 4. Determinar o status mais recente baseado nos eventos
  let latestStatus: ShipmentStatus | null = null;
  let latestEventDate: Date | null = null;

  for (const evento of rastreio.eventos) {
    const eventStatus = mapCorreiosEventToStatus(evento.codigo, evento.descricao);
    if (eventStatus && (!latestEventDate || evento.dataHora > latestEventDate)) {
      latestStatus = eventStatus;
      latestEventDate = evento.dataHora;
    }
  }

  // 5. Atualizar banco em uma transação
  let eventsAdded = 0;
  let statusUpdated = false;
  const previousStatus = shipment.status;

  await prisma.$transaction(async (tx) => {
    // Adicionar novos eventos
    for (const evento of newEvents) {
      await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          type: mapCorreiosEventToStatus(evento.codigo, evento.descricao) || 'CORREIOS_EVENT',
          description: evento.descricao,
          city: evento.cidade || null,
          uf: evento.uf || null,
          occurredAt: evento.dataHora,
        },
      });
      eventsAdded++;
    }

    // Atualizar status do shipment se necessário
    if (latestStatus && latestStatus !== shipment.status) {
      const updateData: { status: string; deliveredAt?: Date } = {
        status: latestStatus,
      };

      // Se foi entregue, registrar data de entrega
      if (latestStatus === ShipmentStatus.DELIVERED && latestEventDate) {
        updateData.deliveredAt = latestEventDate;
      }

      await tx.shipment.update({
        where: { id: shipment.id },
        data: updateData,
      });
      statusUpdated = true;
    }
  });

  logger.info({
    event: 'correios_sync_tracking_complete',
    trackingCode: sroCode,
    shipmentId: shipment.id,
    eventsAdded,
    statusUpdated,
    newStatus: latestStatus,
    previousStatus,
  }, 'Correios tracking sync completed');

  return {
    success: true,
    shipmentId: shipment.id,
    trackingCode: sroCode,
    message: eventsAdded > 0 || statusUpdated
      ? `Sincronização concluída: ${eventsAdded} evento(s) adicionado(s)${statusUpdated ? ', status atualizado' : ''}`
      : 'Nenhuma atualização necessária (já sincronizado)',
    eventsAdded,
    statusUpdated,
    newStatus: latestStatus || undefined,
    previousStatus,
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
