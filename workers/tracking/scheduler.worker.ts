/**
 * Worker: Tracking Scheduler
 *
 * Job repeatable que roda a cada 15 minutos.
 * Busca envios em trânsito e enfileira um job de tracking individual
 * para cada um na fila do carrier correspondente.
 *
 * Separa a lógica de "quais envios precisam de sync" da lógica de
 * "como sincronizar com cada carrier".
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { TrackingJobPayload } from '../../platform/queue/types';
import { prisma } from '../../platform/db/db';

// Status que indicam envio ainda em andamento (precisa de tracking)
const ACTIVE_STATUSES = [
  'PICKUP_REQUESTED',
  'PICKED_UP',
  'WITH_CARRIER',
  'RECEIVED_AT_ORIGIN_HUB',
  'IN_TRANSFER',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERY_PROBLEM',
  'AWAITING_PICKUP_AT_AGENCY',
  'AWAITING_DROP_OFF_AT_POINT',
  'AWAITING_CUSTOMS_CLEARANCE',
  'DIMENSION_DIVERGENCE',
];

// Máximo de envios por execução (evitar sobrecarga)
const MAX_SHIPMENTS_PER_RUN = 200;

interface SchedulerPayload {
  trigger: 'scheduled' | 'manual';
}

async function processSchedulerJob(job: Job<SchedulerPayload>): Promise<void> {
  const log = createJobLogger(job);

  log.info({}, 'Starting tracking scheduler');

  const { result: shipments, durationMs: queryMs } = await withDuration(() =>
    prisma.shipment.findMany({
      where: {
        carrierTrackingCode: { not: null },
        status: { in: ACTIVE_STATUSES },
      },
      select: {
        id: true,
        carrierTrackingCode: true,
        carrier: true,
      },
      take: MAX_SHIPMENTS_PER_RUN,
      orderBy: { updatedAt: 'asc' }, // Priorizar os que não atualizam há mais tempo
    })
  );

  log.info({ totalShipments: shipments.length, queryMs }, 'Found shipments to track');

  // Contadores
  let enqueued = { correios: 0, jt: 0, loggi: 0, skipped: 0 };

  for (const shipment of shipments) {
    if (!shipment.carrierTrackingCode) continue;

    const carrier = (shipment.carrier || '').toLowerCase().trim();
    const payload: TrackingJobPayload = {
      shipmentId: shipment.id,
      trackingCode: shipment.carrierTrackingCode,
      carrier: carrier as TrackingJobPayload['carrier'],
    };

    // Usar o tracking code como job ID para deduplicação natural do BullMQ
    const jobId = `track-${shipment.carrierTrackingCode}`;

    try {
      if (carrier === 'correios') {
        const queue = getQueue<TrackingJobPayload>(QUEUE_NAMES.TRACKING_CORREIOS);
        await queue.add('sync', payload, { jobId, priority: JOB_PRIORITY.MEDIUM });
        enqueued.correios++;
      } else if (carrier === 'jt' || carrier === 'j&t') {
        const queue = getQueue<TrackingJobPayload>(QUEUE_NAMES.TRACKING_JT);
        await queue.add('sync', payload, { jobId, priority: JOB_PRIORITY.MEDIUM });
        enqueued.jt++;
      } else if (carrier === 'loggi') {
        const queue = getQueue<TrackingJobPayload>(QUEUE_NAMES.TRACKING_LOGGI);
        await queue.add('sync', payload, { jobId, priority: JOB_PRIORITY.MEDIUM });
        enqueued.loggi++;
      } else {
        enqueued.skipped++;
      }
    } catch (err) {
      log.warn({
        shipmentId: shipment.id,
        error: (err as Error).message,
      }, 'Failed to enqueue tracking job');
    }
  }

  log.info({
    enqueued,
    totalProcessed: shipments.length,
  }, 'Tracking scheduler completed');
}

/**
 * Cria e retorna o Worker do scheduler de tracking
 */
export function createTrackingSchedulerWorker(): Worker<SchedulerPayload> {
  const worker = new Worker<SchedulerPayload>(
    QUEUE_NAMES.TRACKING_SCHEDULER,
    processSchedulerJob,
    {
      connection: queueConnection,
      concurrency: 1, // Apenas 1 scheduler de cada vez
    }
  );

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Tracking scheduler failed',
      queue: QUEUE_NAMES.TRACKING_SCHEDULER,
      jobId: job?.id,
      error: err.message,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}

/**
 * Registra o job repeatable do scheduler
 * Chamado uma vez na inicialização do worker process.
 */
export async function registerTrackingSchedulerRepeatable(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.TRACKING_SCHEDULER);

  // Remove repeatables antigos para evitar duplicatas ao reiniciar
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Registrar job repeatable: a cada 15 minutos
  await queue.add(
    'schedule',
    { trigger: 'scheduled' },
    {
      repeat: { every: 15 * 60 * 1000 }, // 15 min
      jobId: 'tracking-scheduler',
    }
  );

  console.log('[SCHEDULER] Tracking scheduler registered: every 15 minutes');
}
