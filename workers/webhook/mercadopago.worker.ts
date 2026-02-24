/**
 * Worker: Webhook Mercado Pago
 *
 * Processa webhooks do MP que já foram validados (HMAC + schema + deduplicação)
 * pela rota HTTP e registrados no banco como PENDING.
 *
 * O processamento pesado acontece aqui:
 * 1. Consulta estado atual no MP (getPaymentById)
 * 2. Atualiza PaymentTransaction + Wallet
 * 3. Marca webhook como PROCESSED
 *
 * Idempotência: verifica se webhook já foi processado antes de agir.
 * Lock Redis por paymentId evita concorrência.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration, acquireLock, releaseLock } from '../../platform/queue/helpers';
import type { MercadoPagoWebhookJobPayload } from '../../platform/queue/types';
import { prisma } from '../../platform/db/db';
import { updatePaymentFromMercadoPago } from '../../platform/integrations/mercadopago/payments';

const LOCK_TTL_MS = 120_000; // 2 min lock por payment

async function processWebhookJob(job: Job<MercadoPagoWebhookJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { webhookRecordId, payload } = job.data;

  const paymentId = payload.data?.id != null ? String(payload.data.id) : undefined;
  const action = payload.action || payload.type;

  log.info({ webhookRecordId, paymentId, action }, 'Processing MP webhook');

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

  // 2. Verificar se é evento de pagamento
  if (payload.type !== 'payment' && !payload.action?.includes('payment')) {
    await prisma.paymentWebhook.update({
      where: { id: webhookRecordId },
      data: {
        status: 'IGNORED',
        errorMessage: `Tipo de evento não suportado: ${payload.type}`,
        processedAt: new Date(),
      },
    });
    log.info({ type: payload.type }, 'Non-payment webhook — ignored');
    return;
  }

  // 3. Verificar se temos paymentId
  if (!paymentId) {
    await prisma.paymentWebhook.update({
      where: { id: webhookRecordId },
      data: {
        status: 'FAILED',
        errorMessage: 'ID do pagamento ausente no payload',
        processedAt: new Date(),
      },
    });
    throw new Error('Payment ID missing in webhook payload');
  }

  // 4. Lock por paymentId (evitar processamento concorrente do mesmo pagamento)
  const lockKey = `lock:webhook:mp:${paymentId}`;
  const acquired = await acquireLock(lockKey, LOCK_TTL_MS);

  if (!acquired) {
    log.warn({ paymentId }, 'Lock already held — will retry later');
    throw new Error('Could not acquire lock — concurrent processing');
  }

  try {
    // 5. Consultar MP e atualizar PaymentTransaction + Wallet
    const { durationMs } = await withDuration(async () => {
      try {
        await updatePaymentFromMercadoPago(paymentId);
      } catch (err: unknown) {
        const errorMsg = (err as Error).message || '';

        // Payment não encontrado no MP (teste/fictício) — ignorar
        if (errorMsg.includes('Payment not found') || errorMsg.includes('not_found')) {
          await prisma.paymentWebhook.update({
            where: { id: webhookRecordId },
            data: {
              status: 'IGNORED',
              errorMessage: `Pagamento não encontrado no MP: ${paymentId}`,
              processedAt: new Date(),
            },
          });
          log.info({ paymentId }, 'Payment not found in MP — ignored (test webhook)');
          return;
        }

        throw err; // Outros erros: retry
      }
    });

    // 6. Marcar webhook como processado
    await prisma.paymentWebhook.update({
      where: { id: webhookRecordId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    log.info({
      webhookRecordId,
      paymentId,
      action,
      durationMs,
    }, 'Webhook processed successfully');

  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Cria e retorna o Worker de webhook Mercado Pago
 */
export function createMercadoPagoWebhookWorker(): Worker<MercadoPagoWebhookJobPayload> {
  const worker = new Worker<MercadoPagoWebhookJobPayload>(
    QUEUE_NAMES.WEBHOOK_MERCADOPAGO,
    processWebhookJob,
    {
      connection: queueConnection,
      concurrency: 3,
    }
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 5;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'MP webhook job moved to DLQ' : 'MP webhook job failed, will retry',
      queue: QUEUE_NAMES.WEBHOOK_MERCADOPAGO,
      jobId: job?.id,
      webhookRecordId: job?.data?.webhookRecordId,
      paymentId: job?.data?.payload?.data?.id,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
