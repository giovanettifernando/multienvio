/**
 * Worker: Webhook Pagar.me
 *
 * Processa webhooks do Pagar.me que já foram registrados no banco como PENDING
 * pela rota HTTP.
 *
 * O processamento acontece aqui:
 * 1. Verificar autenticidade via chamada à API (Pagar.me não oferece HMAC)
 * 2. Atualizar PaymentTransaction a partir do pedido no Pagar.me
 * 3. Marcar webhook como PROCESSED
 *
 * Idempotência: verifica se webhook já foi processado antes de agir.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { PagarmeWebhookJobPayload } from '../../platform/queue/types';
import { prisma } from '../../platform/db/db';
import { updatePaymentFromPagarme, verifyWebhookEvent } from '../../platform/integrations/pagarme';

async function processWebhookJob(job: Job<PagarmeWebhookJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { webhookRecordId, orderId, eventType } = job.data;

  log.info({ webhookRecordId, orderId, eventType }, 'Processing Pagar.me webhook');

  // 1. Verificar se webhook ainda está PENDING (idempotência)
  const webhookRecord = await prisma.paymentWebhook.findUnique({
    where: { id: webhookRecordId },
  });

  if (!webhookRecord) {
    log.warn({ webhookRecordId }, 'Webhook record not found — skipping');
    return;
  }

  if (webhookRecord.status === 'PROCESSED') {
    log.info({ webhookRecordId }, 'Webhook already processed — idempotent skip');
    return;
  }

  // 2. Verificar autenticidade via API Pagar.me (não há HMAC)
  const payload = webhookRecord.payload as Record<string, unknown>;
  const pagarmePayload = payload as unknown as Parameters<typeof verifyWebhookEvent>[0];
  const isValid = await verifyWebhookEvent(pagarmePayload);

  if (!isValid) {
    await prisma.paymentWebhook.update({
      where: { id: webhookRecordId },
      data: {
        status: 'FAILED',
        errorMessage: `Order not found in Pagar.me: ${orderId}`,
        processedAt: new Date(),
      },
    });
    log.warn({ webhookRecordId, orderId }, 'Order not found in Pagar.me — webhook marked as FAILED');
    return;
  }

  // 3. Atualizar PaymentTransaction a partir do pedido
  await withDuration(async () => {
    try {
      await updatePaymentFromPagarme(orderId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      await prisma.paymentWebhook.update({
        where: { id: webhookRecordId },
        data: { status: 'FAILED', errorMessage: msg, processedAt: new Date() },
      });
      throw err; // Permite retry automático pelo BullMQ
    }
  });

  // 4. Marcar webhook como processado
  await prisma.paymentWebhook.update({
    where: { id: webhookRecordId },
    data: { status: 'PROCESSED', processedAt: new Date() },
  });

  log.info({ webhookRecordId, orderId, eventType }, 'Pagar.me webhook processed successfully');
}

/**
 * Cria e retorna o Worker de webhook Pagar.me
 */
export function createPagarmeWebhookWorker(): Worker<PagarmeWebhookJobPayload> {
  const worker = new Worker<PagarmeWebhookJobPayload>(
    QUEUE_NAMES.WEBHOOK_PAGARME,
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
      msg: isDLQ ? 'Pagar.me webhook job moved to DLQ' : 'Pagar.me webhook job failed, will retry',
      queue: QUEUE_NAMES.WEBHOOK_PAGARME,
      jobId: job?.id,
      webhookRecordId: job?.data?.webhookRecordId,
      orderId: job?.data?.orderId,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
