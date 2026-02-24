/**
 * Worker: PIX Monitor
 *
 * Job repeatable que roda a cada 2 minutos.
 * Substitui o cron HTTP POST /api/cron/pix-monitor.
 *
 * Verifica pagamentos PIX pendentes no Mercado Pago,
 * marca expirados e registra na carteira do usuário.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueue, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { PixMonitorJobPayload } from '../../platform/queue/types';
import {
  monitorPendingPixPayments,
  cleanupOldPendingPix,
} from '../../platform/integrations/mercadopago/pix-monitor';

async function processPixMonitorJob(job: Job<PixMonitorJobPayload>): Promise<void> {
  const log = createJobLogger(job);

  log.info({ trigger: job.data.trigger }, 'Starting PIX monitor');

  // 1. Monitorar PIX pendentes
  const { result: monitorResult, durationMs: monitorMs } = await withDuration(() =>
    monitorPendingPixPayments()
  );

  // 2. Limpar PIX muito antigos
  const { result: cleanedUp, durationMs: cleanupMs } = await withDuration(() =>
    cleanupOldPendingPix()
  );

  log.info({
    processed: monitorResult.processed,
    approved: monitorResult.approved,
    expired: monitorResult.expired,
    pending: monitorResult.pending,
    errors: monitorResult.errors,
    cleanedUp,
    monitorMs,
    cleanupMs,
    totalMs: monitorMs + cleanupMs,
  }, 'PIX monitor completed');
}

/**
 * Cria e retorna o Worker do PIX Monitor
 */
export function createPixMonitorWorker(): Worker<PixMonitorJobPayload> {
  const worker = new Worker<PixMonitorJobPayload>(
    QUEUE_NAMES.PAYMENT_PIX_MONITOR,
    processPixMonitorJob,
    {
      connection: queueConnection,
      concurrency: 1, // Apenas 1 monitor por vez
    }
  );

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'PIX monitor job failed',
      queue: QUEUE_NAMES.PAYMENT_PIX_MONITOR,
      jobId: job?.id,
      error: err.message,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}

/**
 * Registra o job repeatable do PIX Monitor
 * Chamado uma vez na inicialização do worker process.
 */
export async function registerPixMonitorRepeatable(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.PAYMENT_PIX_MONITOR);

  // Remove repeatables antigos para evitar duplicatas
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Registrar job repeatable: a cada 2 minutos
  await queue.add(
    'monitor',
    { trigger: 'scheduled' },
    {
      repeat: { every: 2 * 60 * 1000 }, // 2 min
      jobId: 'pix-monitor',
    }
  );

  console.log('[SCHEDULER] PIX monitor registered: every 2 minutes');
}
