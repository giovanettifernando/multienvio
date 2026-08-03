/**
 * BullMQ Queue Infrastructure
 *
 * Exportações centralizadas para uso pelo app (enfileirar jobs)
 * e pelos workers (processar jobs).
 */

// Conexão
export { queueConnection } from './connection';

// Filas
export { getQueue, closeAllQueues, getAllQueueNames, getQueueLimiter } from './queues';

// Tipos
export {
  QUEUE_NAMES,
  JOB_PRIORITY,
  type QueueName,
  // Tracking
  type TrackingJobPayload,
  // Webhooks
  type PagarmeWebhookJobPayload,
  type AsaasWebhookJobData,
  // Pagamentos
  type PixMonitorJobPayload,
  type RecipientPaymentExpirationJobPayload,
  // Email
  type EmailJobPayload,
  // Shipment
  type ShipmentCreateJobPayload,
  type LabelGenerateJobPayload,
  // Notificações
  type NotificationStatusJobPayload,
  // Reconciliação
  type ReconciliationJobPayload,
  // PDF
  type PdfGenerateJobPayload,
  type PdfGenerateLabelPayload,
  type PdfGeneratePackagePayload,
  type PdfGenerateStatementPayload,
  type PdfGenerateBatchLabelsPayload,
  // Admin sync
  type FipeSyncJobPayload,
  type CorreiosAgenciesSyncJobPayload,
} from './types';

// Helpers
export {
  createJobLogger,
  acquireLock,
  releaseLock,
  closeLockRedis,
  withDuration,
  type JobLogger,
} from './helpers';

// ============================================================================
// Enqueue helpers
// ============================================================================

import { getQueue } from './queues';
import { QUEUE_NAMES, JOB_PRIORITY, type AsaasWebhookJobData } from './types';

/**
 * Enfileira um job de processamento de webhook do Asaas.
 *
 * A dedupe do EVENTO já aconteceu na rota (constraint de unicidade em
 * `payment_webhooks`). O `jobId` aqui evita apenas duplicar o job em si caso
 * a mesma requisição HTTP seja re-tentada antes de a fila confirmar o enqueue.
 */
export async function enqueueAsaasWebhook(data: AsaasWebhookJobData): Promise<void> {
  const queue = getQueue<AsaasWebhookJobData>(QUEUE_NAMES.WEBHOOK_ASAAS);
  await queue.add('process', data, {
    priority: JOB_PRIORITY.CRITICAL,
    jobId: `asaas-webhook-${data.chargeId}-${data.event}`,
  });
}
