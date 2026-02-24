/**
 * Worker: Tracking Correios
 *
 * Processa jobs de sincronização de rastreamento individual por envio.
 * Cada job = 1 consulta à API dos Correios para 1 tracking code.
 *
 * Idempotência: eventos são deduplicados por (description, city, date)
 * no service syncCorreiosTracking() existente.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration, acquireLock, releaseLock } from '../../platform/queue/helpers';
import type { TrackingJobPayload } from '../../platform/queue/types';
import { syncCorreiosTracking } from '../../modules/tracking/application/sync-correios-tracking.service';

const LOCK_TTL_MS = 60_000; // 60s lock por shipment

async function processTrackingJob(job: Job<TrackingJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { shipmentId, trackingCode } = job.data;

  log.info({ shipmentId, trackingCode }, 'Starting Correios tracking sync');

  // Lock para evitar sync concorrente do mesmo envio
  const lockKey = `lock:tracking:correios:${shipmentId}`;
  const acquired = await acquireLock(lockKey, LOCK_TTL_MS);

  if (!acquired) {
    log.warn({ shipmentId }, 'Skipping — lock already held by another job');
    return; // Não falhar, apenas skip (outro job está processando)
  }

  try {
    const { result, durationMs } = await withDuration(() =>
      syncCorreiosTracking(trackingCode)
    );

    if (result.success) {
      log.info({
        shipmentId,
        trackingCode,
        eventsAdded: result.eventsAdded,
        statusUpdated: result.statusUpdated,
        newStatus: result.newStatus,
        durationMs,
      }, 'Tracking sync completed');
    } else {
      log.warn({
        shipmentId,
        trackingCode,
        message: result.message,
        durationMs,
      }, 'Tracking sync returned no updates');
    }
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Cria e retorna o Worker de tracking Correios
 */
export function createCorreiosTrackingWorker(): Worker<TrackingJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.TRACKING_CORREIOS);

  const worker = new Worker<TrackingJobPayload>(
    QUEUE_NAMES.TRACKING_CORREIOS,
    processTrackingJob,
    {
      connection: queueConnection,
      concurrency: 5,
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 4;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Job moved to DLQ' : 'Job failed, will retry',
      queue: QUEUE_NAMES.TRACKING_CORREIOS,
      jobId: job?.id,
      shipmentId: job?.data?.shipmentId,
      trackingCode: job?.data?.trackingCode,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
