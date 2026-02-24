/**
 * Worker: Tracking J&T
 *
 * Processa jobs de sincronização de rastreamento para envios J&T.
 * Atualmente J&T não tem API de tracking pública integrada,
 * então este worker fica preparado para quando a integração existir.
 *
 * Por enquanto, loga e marca como concluído.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger } from '../../platform/queue/helpers';
import type { TrackingJobPayload } from '../../platform/queue/types';

async function processTrackingJob(job: Job<TrackingJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { shipmentId, trackingCode } = job.data;

  // TODO: Implementar integração com API de rastreamento J&T
  // quando disponível. Por enquanto, apenas loga.
  log.info({ shipmentId, trackingCode }, 'J&T tracking sync — API not yet integrated');
}

/**
 * Cria e retorna o Worker de tracking J&T
 */
export function createJTTrackingWorker(): Worker<TrackingJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.TRACKING_JT);

  const worker = new Worker<TrackingJobPayload>(
    QUEUE_NAMES.TRACKING_JT,
    processTrackingJob,
    {
      connection: queueConnection,
      concurrency: 3,
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'J&T tracking job failed',
      queue: QUEUE_NAMES.TRACKING_JT,
      jobId: job?.id,
      shipmentId: job?.data?.shipmentId,
      error: err.message,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
