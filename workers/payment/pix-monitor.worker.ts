/**
 * Worker: PIX/Boleto Monitor
 *
 * Job repeatable que roda a cada 2 minutos.
 * Substitui o cron HTTP POST /api/cron/pix-monitor.
 *
 * Rede de segurança do sistema de webhooks do Asaas: sincroniza transações
 * PENDING que ficaram órfãs (webhook perdido ou fila pausada por falhas
 * consecutivas). Cobre PIX pago fora do nosso fluxo, boleto compensado e
 * boleto vencido sem pagamento — este último não gera webhook confiável e
 * só é cancelado por esta varredura.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueue, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { PixMonitorJobPayload } from '../../platform/queue/types';
import { syncPendingCharges } from '../../platform/integrations/asaas/pix-monitor';

async function processPixMonitorJob(job: Job<PixMonitorJobPayload>): Promise<void> {
  const log = createJobLogger(job);

  log.info({ trigger: job.data.trigger }, 'Starting PIX/boleto monitor');

  const { result: syncResult, durationMs } = await withDuration(() => syncPendingCharges());

  log.info({
    checked: syncResult.checked,
    updated: syncResult.updated,
    expired: syncResult.expired,
    durationMs,
  }, 'PIX/boleto monitor completed');
}

/**
 * Cria e retorna o Worker do PIX/Boleto Monitor
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
      msg: 'PIX/boleto monitor job failed',
      queue: QUEUE_NAMES.PAYMENT_PIX_MONITOR,
      jobId: job?.id,
      error: err.message,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}

/**
 * Registra o job repeatable do PIX/Boleto Monitor
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

  console.log('[SCHEDULER] PIX/boleto monitor registered: every 2 minutes');
}
