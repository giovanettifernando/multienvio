/**
 * Worker: Tracking Loggi
 *
 * Processa jobs de sincronização de rastreamento para envios Loggi.
 * Consulta a API de tracking da Loggi e sincroniza eventos no banco.
 *
 * Idempotência: eventos deduplicados por (description, city, date)
 * no service syncLoggiTracking().
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration, acquireLock, releaseLock } from '../../platform/queue/helpers';
import type { TrackingJobPayload } from '../../platform/queue/types';
import { syncLoggiTracking } from '../../modules/tracking/application/sync-loggi-tracking.service';

const LOCK_TTL_MS = 60_000; // 60s lock por shipment

async function processTrackingJob(job: Job<TrackingJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { shipmentId, trackingCode } = job.data;

  log.info({ shipmentId, trackingCode }, 'Starting Loggi tracking sync');

  // Lock para evitar sync concorrente do mesmo envio
  const lockKey = `lock:tracking:loggi:${shipmentId}`;
  const acquired = await acquireLock(lockKey, LOCK_TTL_MS);

  if (!acquired) {
    log.warn({ shipmentId }, 'Skipping — lock already held by another job');
    return;
  }

  try {
    const { result, durationMs } = await withDuration(() =>
      syncLoggiTracking(trackingCode)
    );

    if (result.success) {
      log.info({
        shipmentId,
        trackingCode,
        eventsAdded: result.eventsAdded,
        statusUpdated: result.statusUpdated,
        newStatus: result.newStatus,
        durationMs,
      }, 'Loggi tracking sync completed');
    } else {
      log.warn({
        shipmentId,
        trackingCode,
        message: result.message,
        durationMs,
      }, 'Loggi tracking sync returned no updates');
    }
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Cria e retorna o Worker de tracking Loggi
 */
export function createLoggiTrackingWorker(): Worker<TrackingJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.TRACKING_LOGGI);

  const worker = new Worker<TrackingJobPayload>(
    QUEUE_NAMES.TRACKING_LOGGI,
    processTrackingJob,
    {
      connection: queueConnection,
      concurrency: 3,
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 3;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Job moved to DLQ' : 'Job failed, will retry',
      queue: QUEUE_NAMES.TRACKING_LOGGI,
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
