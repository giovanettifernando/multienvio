/**
 * Helpers para workers BullMQ
 *
 * - Logger contextualizado por job
 * - Lock Redis para idempotência
 * - Métricas de duração
 */

import { type Job } from 'bullmq';
import Redis from 'ioredis';
import { queueConnection } from './connection';

// ============================================================================
// Logger de job
// ============================================================================

export interface JobLogger {
  info(data: Record<string, unknown>, message: string): void;
  warn(data: Record<string, unknown>, message: string): void;
  error(data: Record<string, unknown>, message: string): void;
}

/**
 * Cria um logger estruturado para um job BullMQ.
 * Prefixo com queue + jobId + attempt para correlação.
 */
export function createJobLogger(job: Job): JobLogger {
  const base = {
    queue: job.queueName,
    jobId: job.id,
    jobName: job.name,
    attempt: job.attemptsMade + 1,
  };

  // Em produção, usar pino importado dinamicamente para evitar
  // dependência de 'server-only' (workers rodam fora do Next.js).
  // Fallback para console estruturado.
  return {
    info(data: Record<string, unknown>, message: string) {
      console.log(JSON.stringify({ level: 'info', msg: message, ...base, ...data, time: new Date().toISOString() }));
    },
    warn(data: Record<string, unknown>, message: string) {
      console.warn(JSON.stringify({ level: 'warn', msg: message, ...base, ...data, time: new Date().toISOString() }));
    },
    error(data: Record<string, unknown>, message: string) {
      console.error(JSON.stringify({ level: 'error', msg: message, ...base, ...data, time: new Date().toISOString() }));
    },
  };
}

// ============================================================================
// Lock Redis (idempotência)
// ============================================================================

let lockRedis: Redis | null = null;

function getLockRedis(): Redis {
  if (!lockRedis) {
    lockRedis = new Redis({
      host: (queueConnection as { host?: string }).host || '127.0.0.1',
      port: (queueConnection as { port?: number }).port || 6379,
      password: (queueConnection as { password?: string }).password,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }
  return lockRedis;
}

/**
 * Tenta adquirir um lock Redis (SETNX com TTL).
 * Retorna true se adquiriu, false se já existe.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const redis = getLockRedis();
  const result = await redis.set(key, '1', 'PX', ttlMs, 'NX');
  return result === 'OK';
}

/**
 * Libera um lock Redis.
 */
export async function releaseLock(key: string): Promise<void> {
  const redis = getLockRedis();
  await redis.del(key);
}

/**
 * Fecha a conexão Redis de locks (para shutdown).
 */
export async function closeLockRedis(): Promise<void> {
  if (lockRedis) {
    await lockRedis.quit();
    lockRedis = null;
  }
}

// ============================================================================
// Timer helper
// ============================================================================

/**
 * Mede duração de uma operação e retorna resultado + duração
 */
export async function withDuration<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}
