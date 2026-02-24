/**
 * Worker: Notification Status (Fase 3)
 *
 * Cria notificações in-app para os usuários.
 * Cada job cria um registro na tabela Notification.
 *
 * Tipos de notificação:
 * - SHIPMENT_CREATED: envio criado com sucesso
 * - SHIPMENT_STATUS_CHANGED: status do envio alterado
 * - SHIPMENT_CREATION_FAILED: falha na criação do envio
 * - PAYMENT_CONFIRMED: pagamento confirmado
 * - LABEL_READY: etiqueta pronta para impressão
 *
 * Retry: 3x com backoff fixo de 30s
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger } from '../../platform/queue/helpers';
import type { NotificationStatusJobPayload } from '../../platform/queue/types';
import { prisma } from '../../platform/db/db';
import type { Prisma } from '@prisma/client';

async function processNotification(job: Job<NotificationStatusJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { userId, type, title, message, metadata } = job.data;

  log.info({ userId, type }, 'Creating in-app notification');

  // Verificar se o usuário existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    log.warn({ userId }, 'User not found — skipping notification');
    return;
  }

  // Criar notificação no banco
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  log.info({ userId, type, title }, 'Notification created successfully');
}

/**
 * Cria e retorna o Worker de notificações in-app
 */
export function createNotificationStatusWorker(): Worker<NotificationStatusJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.NOTIFICATION_STATUS);

  const worker = new Worker<NotificationStatusJobPayload>(
    QUEUE_NAMES.NOTIFICATION_STATUS,
    processNotification,
    {
      connection: queueConnection,
      concurrency: 5,
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 3;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Notification moved to DLQ' : 'Notification failed, will retry',
      queue: QUEUE_NAMES.NOTIFICATION_STATUS,
      jobId: job?.id,
      userId: job?.data?.userId,
      type: job?.data?.type,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
