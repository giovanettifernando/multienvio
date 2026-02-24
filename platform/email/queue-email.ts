import 'server-only';

/**
 * Enfileira emails para envio assíncrono via BullMQ.
 *
 * Uso:
 *   import { queueEmail } from '@/platform/email/queue-email';
 *   await queueEmail({ to, subject, html });
 *
 * Vantagens sobre sendEmail() direto:
 * - Retry automático (4 tentativas com backoff exponencial)
 * - Rate limiting (5 emails/s)
 * - Não bloqueia a request HTTP
 * - Jobs persistem em Redis (sobrevivem a restarts)
 */

import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { EmailJobPayload } from '@/platform/queue/types';

export interface QueueEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Chave para deduplicação (impede envio duplicado) */
  deduplicationKey?: string;
  /** Prioridade do email (default: LOW) */
  priority?: number;
  /** Delay em ms antes de enviar (default: 0) */
  delay?: number;
}

/**
 * Enfileira um email para envio assíncrono
 */
export async function queueEmail(options: QueueEmailOptions): Promise<string> {
  const queue = getQueue<EmailJobPayload>(QUEUE_NAMES.EMAIL);

  const job = await queue.add(
    'send',
    {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      deduplicationKey: options.deduplicationKey,
    },
    {
      priority: options.priority ?? JOB_PRIORITY.LOW,
      delay: options.delay,
      jobId: options.deduplicationKey
        ? `email-${options.deduplicationKey}`
        : undefined,
    }
  );

  return job.id ?? '';
}

/**
 * Enfileira múltiplos emails
 */
export async function queueEmailBatch(
  emails: QueueEmailOptions[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const email of emails) {
    const id = await queueEmail(email);
    ids.push(id);
  }
  return ids;
}
