/**
 * Worker: Recipient Payment Expiration
 *
 * Job repeatable que roda a cada hora.
 * Substitui o cron HTTP POST /api/cron/recipient-payment-expiration.
 *
 * Expira solicitações de pagamento pelo destinatário que passaram do prazo (72h)
 * e envia lembretes para as que estão prestes a expirar (24h).
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueue, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { RecipientPaymentExpirationJobPayload } from '../../platform/queue/types';
import {
  expirePendingRequests,
  getRequestsExpiringWithin,
} from '../../modules/recipients/application/service';
import {
  sendRecipientPaymentExpiredEmail,
  sendRecipientPaymentReminderEmail,
} from '../../platform/email/recipient-payment';
import { prisma } from '../../platform/db/db';

async function processExpirationJob(job: Job<RecipientPaymentExpirationJobPayload>): Promise<void> {
  const log = createJobLogger(job);

  log.info({ trigger: job.data.trigger }, 'Starting recipient payment expiration');

  let expiredCount = 0;
  let remindersCount = 0;
  let errorCount = 0;

  // 1. Expirar requests pendentes
  const { result: expiredRequests, durationMs: expireMs } = await withDuration(() =>
    expirePendingRequests()
  );
  expiredCount = expiredRequests.length;

  // 2. Enviar e-mails de expiração
  for (const request of expiredRequests) {
    try {
      await sendRecipientPaymentExpiredEmail({
        recipientName: request.recipientName,
        recipientEmail: request.recipientEmail,
        senderName: 'Remetente',
        originCity: request.originCity,
        originState: request.originState,
        destinationCity: request.destinationCity,
        destinationState: request.destinationState,
      });
    } catch (err) {
      errorCount++;
      log.warn({
        email: request.recipientEmail,
        error: (err as Error).message,
      }, 'Failed to send expiration email');
    }
  }

  // 3. Enviar lembretes (24h antes de expirar)
  const expiringRequests = await getRequestsExpiringWithin(24);

  for (const request of expiringRequests) {
    try {
      const sender = await prisma.user.findUnique({
        where: { id: request.senderId },
        select: { name: true, razaoSocial: true },
      });

      const senderName = sender?.razaoSocial || sender?.name || 'Remetente';

      await sendRecipientPaymentReminderEmail({
        recipientName: request.recipientName,
        recipientEmail: request.recipientEmail,
        senderName,
        paymentToken: request.paymentToken,
        expiresAt: request.expiresAt,
        totalCents: request.totalCents,
        originCity: request.originCity,
        originState: request.originState,
        destinationCity: request.destinationCity,
        destinationState: request.destinationState,
      });

      remindersCount++;
    } catch (err) {
      errorCount++;
      log.warn({
        email: request.recipientEmail,
        error: (err as Error).message,
      }, 'Failed to send reminder email');
    }
  }

  log.info({
    expiredCount,
    remindersCount,
    errorCount,
    expireMs,
  }, 'Recipient payment expiration completed');
}

/**
 * Cria e retorna o Worker de expiração de pagamentos de destinatário
 */
export function createRecipientExpirationWorker(): Worker<RecipientPaymentExpirationJobPayload> {
  const worker = new Worker<RecipientPaymentExpirationJobPayload>(
    QUEUE_NAMES.PAYMENT_RECIPIENT_EXPIRATION,
    processExpirationJob,
    {
      connection: queueConnection,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Recipient expiration job failed',
      queue: QUEUE_NAMES.PAYMENT_RECIPIENT_EXPIRATION,
      jobId: job?.id,
      error: err.message,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}

/**
 * Registra o job repeatable de expiração
 * Chamado uma vez na inicialização do worker process.
 */
export async function registerRecipientExpirationRepeatable(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.PAYMENT_RECIPIENT_EXPIRATION);

  // Remove repeatables antigos
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Registrar job repeatable: a cada 1 hora
  await queue.add(
    'expire',
    { trigger: 'scheduled' },
    {
      repeat: { every: 60 * 60 * 1000 }, // 1 hora
      jobId: 'recipient-expiration',
    }
  );

  console.log('[SCHEDULER] Recipient payment expiration registered: every 1 hour');
}
