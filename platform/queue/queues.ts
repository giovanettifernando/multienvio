/**
 * Definição e factory de filas BullMQ
 *
 * Centraliza a criação de filas com configurações de retry,
 * rate limiting e prioridade por domínio/carrier.
 */

import { Queue, type QueueOptions } from 'bullmq';
import { queueConnection } from './connection';
import { QUEUE_NAMES, type QueueName } from './types';

// ============================================================================
// Configurações por fila
// ============================================================================

interface QueueConfig {
  defaultJobOptions: QueueOptions['defaultJobOptions'];
  limiter?: { max: number; duration: number };
}

const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  // --- Tracking ---
  [QUEUE_NAMES.TRACKING_CORREIOS]: {
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: false, // manter para DLQ/inspeção
    },
    limiter: { max: 10, duration: 1000 }, // 10 req/s Correios
  },

  [QUEUE_NAMES.TRACKING_JT]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: false,
    },
    limiter: { max: 20, duration: 1000 },
  },

  [QUEUE_NAMES.TRACKING_LOGGI]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: false,
    },
    limiter: { max: 15, duration: 1000 },
  },

  [QUEUE_NAMES.TRACKING_SCHEDULER]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5_000 },
      removeOnComplete: { age: 3_600, count: 100 },
      removeOnFail: false,
    },
  },

  // --- Webhooks ---
  [QUEUE_NAMES.WEBHOOK_MERCADOPAGO]: {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 604_800, count: 5000 }, // 7 dias
      removeOnFail: false,
    },
  },

  [QUEUE_NAMES.WEBHOOK_PAGARME]: {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 604_800, count: 5000 }, // 7 dias
      removeOnFail: false,
    },
  },

  // --- Pagamentos ---
  [QUEUE_NAMES.PAYMENT_PIX_MONITOR]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 86_400, count: 500 },
      removeOnFail: false,
    },
    limiter: { max: 5, duration: 1000 }, // 5 req/s para MP
  },

  [QUEUE_NAMES.PAYMENT_RECIPIENT_EXPIRATION]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 86_400, count: 100 },
      removeOnFail: false,
    },
  },

  // --- Email ---
  [QUEUE_NAMES.EMAIL]: {
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: 'exponential', delay: 15_000 }, // 15s, 30s, 60s, 120s
      removeOnComplete: { age: 86_400, count: 2000 },
      removeOnFail: false,
    },
    limiter: { max: 5, duration: 1000 }, // 5 emails/s max
  },

  // --- Shipment (Fase 3) ---
  [QUEUE_NAMES.SHIPMENT_CREATE]: {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 }, // 30s, 60s, 120s, 240s, 480s
      removeOnComplete: { age: 604_800, count: 5000 }, // 7 dias
      removeOnFail: false,
    },
  },

  [QUEUE_NAMES.LABEL_GENERATE]: {
    defaultJobOptions: {
      attempts: 6,
      backoff: { type: 'exponential', delay: 30_000 }, // 30s, 60s, 120s, 240s, 480s → ~15min total
      removeOnComplete: { age: 86_400, count: 2000 },
      removeOnFail: false,
    },
  },

  // --- Notificações (Fase 3) ---
  [QUEUE_NAMES.NOTIFICATION_STATUS]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 30_000 },
      removeOnComplete: { age: 86_400, count: 5000 },
      removeOnFail: false,
    },
  },

  // --- Reconciliação (Fase 3) ---
  [QUEUE_NAMES.RECONCILIATION]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 604_800, count: 100 }, // 7 dias
      removeOnFail: false,
    },
  },

  // --- Geração de PDF ---
  [QUEUE_NAMES.PDF_GENERATE]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 }, // 15s, 30s, 60s
      removeOnComplete: { age: 86_400, count: 2000 }, // 24h
      removeOnFail: false,
    },
    limiter: { max: 5, duration: 1000 }, // 5 jobs/s (protege API Correios)
  },

  // --- Admin: FIPE Sync ---
  [QUEUE_NAMES.FIPE_SYNC]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 500 },
      removeOnFail: false,
    },
    limiter: { max: 3, duration: 1000 }, // 3 req/s (API FIPE rate limit)
  },

  // --- Admin: Correios Agencies Sync ---
  [QUEUE_NAMES.CORREIOS_AGENCIES_SYNC]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: { age: 86_400, count: 100 },
      removeOnFail: false,
    },
    limiter: { max: 2, duration: 1000 }, // 2 req/s (API Correios)
  },
};

// ============================================================================
// Singleton cache de filas
// ============================================================================

const queueInstances = new Map<QueueName, Queue>();

/**
 * Retorna (ou cria) a instância de uma fila BullMQ
 */
export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  if (!queueInstances.has(name)) {
    const config = QUEUE_CONFIGS[name];

    const queue = new Queue<T>(name, {
      connection: queueConnection,
      defaultJobOptions: config.defaultJobOptions,
    });

    queueInstances.set(name, queue as Queue);
  }

  return queueInstances.get(name) as Queue<T>;
}

/**
 * Fecha todas as filas (para shutdown graceful)
 */
export async function closeAllQueues(): Promise<void> {
  const promises = Array.from(queueInstances.values()).map((q) => q.close());
  await Promise.all(promises);
  queueInstances.clear();
}

/**
 * Retorna os nomes de todas as filas registradas
 */
export function getAllQueueNames(): QueueName[] {
  return Object.values(QUEUE_NAMES);
}

/**
 * Retorna o rate limiter configurado para a fila (se houver)
 */
export function getQueueLimiter(name: QueueName) {
  return QUEUE_CONFIGS[name]?.limiter;
}
