/**
 * POST /api/tracking/sync-all
 *
 * Sincroniza rastreamento de todos os envios dos Correios do usuário.
 * Enfileira jobs na fila TRACKING_CORREIOS e retorna 202.
 */

import { requireUserSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';
import { getQueue, QUEUE_NAMES, type TrackingJobPayload } from '@/platform/queue';

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
  shipmentsEnqueued: number;
  message: string;
}

/**
 * POST - Enfileira sincronização de rastreamento via BullMQ
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
    },
  });

  if (shipmentsToSync.length === 0) {
    return {
      data: {
        started: false,
        shipmentsEnqueued: 0,
        message: 'Nenhum envio dos Correios pendente para sincronizar',
      },
    };
  }

  // Enfileirar um job por shipment na fila de tracking Correios
  const queue = getQueue<TrackingJobPayload>(QUEUE_NAMES.TRACKING_CORREIOS);

  const jobs = shipmentsToSync
    .filter((s) => s.carrierTrackingCode)
    .map((shipment) => ({
      name: 'sync-user-request',
      data: {
        shipmentId: shipment.id,
        trackingCode: shipment.carrierTrackingCode!,
        carrier: 'correios' as const,
      },
      opts: {
        jobId: `tracking-user-${shipment.id}-${Date.now()}`,
      },
    }));

  await queue.addBulk(jobs);

  return {
    status: 202,
    data: {
      started: true,
      shipmentsEnqueued: jobs.length,
      message: `Sincronização enfileirada para ${jobs.length} envio(s)`,
    },
  };
});
