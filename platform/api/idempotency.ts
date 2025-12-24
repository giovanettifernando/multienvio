/**
 * Middleware de idempotência para operações críticas
 *
 * SECURITY: Previne processamento duplicado de operações financeiras
 * quando há retries por timeout ou problemas de rede.
 *
 * IMPORTANTE: Em produção, usa Redis para garantir idempotência distribuída.
 * Em desenvolvimento, fallback para Map em memória.
 */

import { getRedisClient, isRedisAvailable } from '@/platform/cache/redis';
import { prefixKey } from '@/platform/cache/cache';
import { logger } from '@/platform/logging/logger';

// Cache em memória (fallback APENAS em desenvolvimento)
const memoryCache = new Map<string, { result: unknown; expiresAt: number }>();

// TTL padrão para resultados de idempotência (5 minutos)
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// Cleanup interval para memory cache
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Verifica se estamos em produção
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Limpar entradas expiradas periodicamente (apenas para fallback em dev)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
      if (value.expiresAt < now) {
        memoryCache.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export interface IdempotencyResult<T> {
  cached: boolean;
  result?: T;
  key: string;
}

/**
 * Verifica se já existe resultado para uma chave de idempotência
 *
 * SECURITY: Em produção, REQUER Redis disponível para garantir idempotência distribuída.
 * Em desenvolvimento, permite fallback para memória local.
 */
export async function checkIdempotency<T>(
  key: string | null | undefined
): Promise<IdempotencyResult<T> | null> {
  if (!key) {
    return null; // Sem chave, não usar idempotência
  }

  // Usar prefixKey para incluir namespace de environment (prod:, dev:, etc.)
  const prefixedKey = prefixKey(`idempotency:${key}`);

  // Tentar Redis primeiro
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(prefixedKey);
      if (cached) {
        logger.info({ event: 'idempotency_cache_hit', key, source: 'redis' }, 'Returning cached idempotency result from Redis');
        return { cached: true, result: JSON.parse(cached) as T, key };
      }
      return { cached: false, key };
    } catch (error) {
      logger.error({ event: 'idempotency_redis_error', key, err: error }, 'Redis error during idempotency check');
      // Em produção, falhar se Redis não funcionar (fail-close)
      if (IS_PRODUCTION) {
        throw new Error('Idempotency check failed: Redis unavailable in production');
      }
      // Em dev, continuar com fallback
    }
  } else if (IS_PRODUCTION) {
    // Em produção, Redis DEVE estar disponível para operações idempotentes
    throw new Error('Idempotency check failed: Redis unavailable in production');
  }

  // Fallback para memory cache (APENAS em desenvolvimento)
  const cached = memoryCache.get(prefixedKey);
  if (cached && cached.expiresAt > Date.now()) {
    logger.info({ event: 'idempotency_cache_hit', key, source: 'memory' }, 'Returning cached idempotency result from memory (dev only)');
    return { cached: true, result: cached.result as T, key };
  }

  return { cached: false, key };
}

/**
 * Salva resultado para uma chave de idempotência
 *
 * SECURITY: Usa SET NX PX para garantir atomicidade (não sobrescreve se já existe).
 * Em produção, REQUER Redis disponível.
 */
export async function saveIdempotencyResult<T>(
  key: string,
  result: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  // Usar prefixKey para incluir namespace de environment
  const prefixedKey = prefixKey(`idempotency:${key}`);
  const serializedResult = JSON.stringify(result);

  // Tentar Redis primeiro
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      // Usar SET com NX (não sobrescreve) e PX (TTL em ms) para atomicidade
      await redis.set(prefixedKey, serializedResult, 'PX', ttlMs, 'NX');
      logger.info({ event: 'idempotency_result_saved', key, ttlMs, source: 'redis' }, 'Idempotency result saved to Redis');
      return;
    } catch (error) {
      logger.error({ event: 'idempotency_save_error', key, err: error }, 'Failed to save idempotency result to Redis');
      // Em produção, falhar se Redis não funcionar (fail-close)
      if (IS_PRODUCTION) {
        throw new Error('Idempotency save failed: Redis unavailable in production');
      }
      // Em dev, continuar com fallback
    }
  } else if (IS_PRODUCTION) {
    // Em produção, Redis DEVE estar disponível
    throw new Error('Idempotency save failed: Redis unavailable in production');
  }

  // Fallback para memory cache (APENAS em desenvolvimento)
  memoryCache.set(prefixedKey, {
    result,
    expiresAt: Date.now() + ttlMs,
  });

  logger.info({ event: 'idempotency_result_saved', key, ttlMs, source: 'memory' }, 'Idempotency result saved to memory (dev only)');
}

/**
 * Remove uma chave de idempotência (útil para operações que falharam)
 */
export async function clearIdempotencyKey(key: string): Promise<void> {
  // Usar prefixKey para incluir namespace de environment
  const prefixedKey = prefixKey(`idempotency:${key}`);

  // Tentar Redis primeiro
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.del(prefixedKey);
      logger.info({ event: 'idempotency_key_cleared', key, source: 'redis' }, 'Idempotency key cleared from Redis');
      return;
    } catch (error) {
      logger.error({ event: 'idempotency_clear_error', key, err: error }, 'Failed to clear idempotency key from Redis');
      // Não é crítico se falhar ao limpar, então não throw em produção
    }
  }

  // Também limpar do memory cache (pode ter sido criado em dev)
  memoryCache.delete(prefixedKey);
}

/**
 * Gera uma chave de idempotência baseada nos parâmetros da requisição
 * Útil quando o cliente não envia uma chave explícita
 */
export function generateIdempotencyKey(
  userId: string,
  operation: string,
  params: Record<string, unknown>
): string {
  const paramsString = JSON.stringify(params, Object.keys(params).sort());
  const hash = Buffer.from(paramsString).toString('base64').slice(0, 32);
  return `${userId}:${operation}:${hash}`;
}

/**
 * Wrapper para operações idempotentes
 *
 * @param key Chave de idempotência (do header X-Idempotency-Key)
 * @param operation Função que executa a operação
 * @param ttlMs Tempo de vida do cache em ms
 */
export async function withIdempotency<T>(
  key: string | null | undefined,
  operation: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<{ result: T; fromCache: boolean }> {
  // Sem chave, executar normalmente sem cache
  if (!key) {
    const result = await operation();
    return { result, fromCache: false };
  }

  // Verificar cache
  const cached = await checkIdempotency<T>(key);
  if (cached?.cached && cached.result !== undefined) {
    return { result: cached.result, fromCache: true };
  }

  // Executar operação
  try {
    const result = await operation();

    // Salvar resultado
    await saveIdempotencyResult(key, result, ttlMs);

    return { result, fromCache: false };
  } catch (error) {
    // Em caso de erro, não salvar no cache para permitir retry
    // Mas não limpar chave existente se houver
    throw error;
  }
}
