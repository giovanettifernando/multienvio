/**
 * POST /api/tracking/sync-all
 *
 * Sincroniza rastreamento de todos os envios dos Correios do usuário.
 * Roda em background - retorna imediatamente e processa em paralelo.
 */

import { requireUserSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { syncCorreiosTracking } from '@/modules/tracking/application/sync-correios-tracking.service';
import { logger } from '@/platform/logging/logger';

// Status que indicam envio ainda em andamento (precisa sincronizar)
const ACTIVE_STATUSES = [
  'PICKUP_REQUESTED',
  'PICKUP_SCHEDULED',
  'AWAITING_PICKUP_AT_ORIGIN',
  'PICKUP_FAILED',
  'AWAITING_DROP_OFF_AT_POINT',
  'DROPPED_OFF_AT_POINT',
  'AWAITING_CARRIER_PICKUP_AT_POINT',
  'COLLECTED_FROM_SENDER',
  'COLLECTED_FROM_POINT',
  'IN_TRANSIT_TO_CARRIER_HUB',
  'RECEIVED_AT_ORIGIN_HUB',
  'IN_TRANSFER',
  'IN_TRANSIT_TO_DESTINATION',
  'AT_DESTINATION_HUB',
  'OUT_FOR_DELIVERY',
  'AWAITING_PICKUP_AT_DESTINATION_HUB',
  'DELIVERY_ATTEMPT_FAILED',
  'DELIVERY_PROBLEM',
  'RETURNING_TO_SENDER',
];

interface SyncResult {
  started: boolean;
  shipmentsToSync: number;
  message: string;
}

/**
 * POST - Inicia sincronização em background
 */
export const POST = withApiHandler<SyncResult>(async ({ req }) => {
  const session = await requireUserSession(req);

  const userId = session.userId;

  // Buscar envios dos Correios do usuário que precisam de sincronização
  const shipmentsToSync = await prisma.shipment.findMany({
    where: {
      senderId: userId,
      carrier: 'Correios',
      carrierTrackingCode: { not: null },
      status: { in: ACTIVE_STATUSES },
    },
    select: {
      id: true,
      carrierTrackingCode: true,
      status: true,
    },
  });

  if (shipmentsToSync.length === 0) {
    return {
      data: {
        started: false,
        shipmentsToSync: 0,
        message: 'Nenhum envio dos Correios pendente para sincronizar',
      },
    };
  }

  logger.info({
    userId,
    shipmentsCount: shipmentsToSync.length,
  }, 'tracking_sync_all_started');

  // Executar sincronização em background (não aguarda)
  // Usamos Promise.allSettled para não falhar se um falhar
  setImmediate(async () => {
    const results = await Promise.allSettled(
      shipmentsToSync.map(async (shipment) => {
        if (!shipment.carrierTrackingCode) return null;
        try {
          const result = await syncCorreiosTracking(shipment.carrierTrackingCode);
          return {
            shipmentId: shipment.id,
            trackingCode: shipment.carrierTrackingCode,
            success: result.success,
            eventsAdded: result.eventsAdded,
            statusUpdated: result.statusUpdated,
          };
        } catch (error) {
          logger.error({
            shipmentId: shipment.id,
            trackingCode: shipment.carrierTrackingCode,
            error: error instanceof Error ? error.message : 'Unknown error',
          }, 'tracking_sync_error');
          return {
            shipmentId: shipment.id,
            trackingCode: shipment.carrierTrackingCode,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value?.success
    ).length;

    logger.info({
      userId,
      total: shipmentsToSync.length,
      success: successCount,
      failed: shipmentsToSync.length - successCount,
    }, 'tracking_sync_all_completed');
  });

  return {
    data: {
      started: true,
      shipmentsToSync: shipmentsToSync.length,
      message: `Sincronização iniciada para ${shipmentsToSync.length} envio(s)`,
    },
  };
});
