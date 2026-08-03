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
import { prisma as defaultPrisma } from '../../platform/db/db';
import { updatePaymentFromAsaas as defaultUpdatePaymentFromAsaas } from '../../platform/integrations/asaas';

export interface AsaasWebhookJobDeps {
  prisma?: typeof defaultPrisma;
  updatePaymentFromAsaas?: typeof defaultUpdatePaymentFromAsaas;
}

/**
 * Processa um job de webhook do Asaas: sincroniza a transação a partir da
 * cobrança e marca o(s) registro(s) dessa cobrança como PROCESSED.
 *
 * A marcação de sucesso NÃO filtra por `status: 'PENDING'`: se a 1ª tentativa
 * falhou, `runAsaasWebhookJob` já deixou o registro em FAILED, e um retry
 * bem-sucedido precisa conseguir corrigi-lo para PROCESSED. Filtrar por
 * PENDING faria esse `updateMany` não casar nada — o job "sucede" do ponto de
 * vista do BullMQ, mas o registro fica FAILED para sempre mesmo com o
 * pagamento já reconhecido (falso positivo permanente no painel de webhooks).
 */
export async function processAsaasWebhookJob(
  data: AsaasWebhookJobData,
  deps: AsaasWebhookJobDeps = {},
): Promise<void> {
  const db = deps.prisma ?? defaultPrisma;
  const doUpdatePaymentFromAsaas = deps.updatePaymentFromAsaas ?? defaultUpdatePaymentFromAsaas;

  await doUpdatePaymentFromAsaas(data.chargeId);

  await db.paymentWebhook.updateMany({
    where: { externalId: data.chargeId, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'PROCESSED', processedAt: new Date() },
  });
}

/**
 * Executa o processamento com marcação de erro: se `processAsaasWebhookJob`
 * falhar, marca o registro PENDING como FAILED (visibilidade no painel) e
 * relança o erro para o BullMQ agendar o retry automático.
 *
 * Extraída de `processWebhookJob` (que depende de `Job`/logger do BullMQ,
 * difícil de testar unitariamente) para aceitar deps injetadas e ser
 * exercitável em teste sem subir Worker/Redis — mesmo padrão de
 * `UpdatePaymentDeps` em `platform/integrations/asaas/tracking.ts`.
 */
export async function runAsaasWebhookJob(
  data: AsaasWebhookJobData,
  deps: AsaasWebhookJobDeps = {},
): Promise<void> {
  const db = deps.prisma ?? defaultPrisma;

  try {
    await processAsaasWebhookJob(data, deps);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    await db.paymentWebhook.updateMany({
      where: { externalId: data.chargeId, status: 'PENDING' },
      data: { status: 'FAILED', errorMessage: msg, processedAt: new Date() },
    });
    throw err; // Permite retry automático pelo BullMQ
  }
}

async function processWebhookJob(job: Job<AsaasWebhookJobData>): Promise<void> {
  const log = createJobLogger(job);
  const { chargeId, event } = job.data;

  log.info({ chargeId, event }, 'Processing Asaas webhook');

  await withDuration(() => runAsaasWebhookJob(job.data));

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
