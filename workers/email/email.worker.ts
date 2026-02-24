/**
 * Worker: Email
 *
 * Envia emails de forma assíncrona com retry automático.
 * Todos os emails da plataforma passam por esta fila para
 * garantir resiliência contra falhas do SMTP server.
 *
 * Concorrência: 2 (evitar sobrecarregar o SMTP)
 * Retry: 4 tentativas com backoff exponencial (15s, 30s, 60s, 120s)
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { EmailJobPayload } from '../../platform/queue/types';
import { sendEmail } from '../../platform/email/mailer';

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { to, subject } = job.data;

  log.info({ to, subject }, 'Sending email');

  const { result: sent, durationMs } = await withDuration(() =>
    sendEmail({
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
    })
  );

  if (!sent) {
    throw new Error(`Failed to send email to ${to}`);
  }

  log.info({ to, subject, durationMs }, 'Email sent successfully');
}

/**
 * Cria e retorna o Worker de email
 */
export function createEmailWorker(): Worker<EmailJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.EMAIL);

  const worker = new Worker<EmailJobPayload>(
    QUEUE_NAMES.EMAIL,
    processEmailJob,
    {
      connection: queueConnection,
      concurrency: 2,
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 4;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Email job moved to DLQ' : 'Email job failed, will retry',
      queue: QUEUE_NAMES.EMAIL,
      jobId: job?.id,
      to: job?.data?.to,
      subject: job?.data?.subject,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
