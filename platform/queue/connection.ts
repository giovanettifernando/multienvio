/**
 * Conexão Redis dedicada para BullMQ
 *
 * Separada da conexão de cache para isolamento.
 * BullMQ precisa de conexões com maxRetriesPerRequest = null
 * (diferente do ioredis padrão usado no cache).
 */

import { type ConnectionOptions } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Parse Redis URL para ConnectionOptions do BullMQ
 */
function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);

  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1) || '0', 10) : 0,
    // BullMQ exige null para blocking commands (BRPOPLPUSH)
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Retry strategy para reconexão
    retryStrategy(times: number) {
      return Math.min(times * 200, 5000);
    },
  };
}

/**
 * Conexão compartilhada entre todas as filas e workers
 */
export const queueConnection: ConnectionOptions = parseRedisUrl(REDIS_URL);
