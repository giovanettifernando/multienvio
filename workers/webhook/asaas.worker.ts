/**
 * Worker: Webhook Asaas
 *
 * Processa webhooks do Asaas que já foram registrados no banco como PENDING
 * pela rota HTTP.
 *
 * O processamento acontece aqui:
 * 1. Reconsultar a cobrança na API do Asaas (updatePaymentFromAsaas) e
 *    sincronizar a PaymentTransaction local
 * 2. Marcar o(s) registro(s) de webhook dessa cobrança como PROCESSED
 *
 * Idempotência: a entrega do Asaas é at-least-once — o mesmo evento pode
 * gerar mais de um job. `updatePaymentFromAsaas` sempre busca o estado atual
 * da cobrança na API, então reprocessar é seguro (idempotente por natureza).
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { AsaasWebhookJobData } from '../../platform/queue/types';
import { prisma } from '../../platform/db/db';
import { updatePaymentFromAsaas } from '../../platform/integrations/asaas';

/**
 * Processa um job de webhook do Asaas: sincroniza a transação a partir da
 * cobrança e marca o(s) registro(s) PENDING correspondentes como PROCESSED.
 */
export async function processAsaasWebhookJob(data: AsaasWebhookJobData): Promise<void> {
  await updatePaymentFromAsaas(data.chargeId);

  await prisma.paymentWebhook.updateMany({
    where: { externalId: data.chargeId, status: 'PENDING' },
    data: { status: 'PROCESSED', processedAt: new Date() },
  });
}

async function processWebhookJob(job: Job<AsaasWebhookJobData>): Promise<void> {
  const log = createJobLogger(job);
  const { chargeId, event } = job.data;

  log.info({ chargeId, event }, 'Processing Asaas webhook');

  await withDuration(async () => {
    try {
      await processAsaasWebhookJob(job.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      await prisma.paymentWebhook.updateMany({
        where: { externalId: chargeId, status: 'PENDING' },
        data: { status: 'FAILED', errorMessage: msg, processedAt: new Date() },
      });
      throw err; // Permite retry automático pelo BullMQ
    }
  });

  log.info({ chargeId, event }, 'Asaas webhook processed successfully');
}

/**
 * Cria e retorna o Worker de webhook Asaas
 */
export function createAsaasWebhookWorker(): Worker<AsaasWebhookJobData> {
  const worker = new Worker<AsaasWebhookJobData>(
    QUEUE_NAMES.WEBHOOK_ASAAS,
    processWebhookJob,
    {
      connection: queueConnection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 5;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Asaas webhook job moved to DLQ' : 'Asaas webhook job failed, will retry',
      queue: QUEUE_NAMES.WEBHOOK_ASAAS,
      jobId: job?.id,
      chargeId: job?.data?.chargeId,
      event: job?.data?.event,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
