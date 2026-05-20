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
