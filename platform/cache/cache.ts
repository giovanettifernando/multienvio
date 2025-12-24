/**
 * Redis Cache Utility
 *
 * Fornece cache para dados frequentemente acessados com:
 * - TTL configurável
 * - Fail-open para cache de dados (fallback se Redis indisponível)
 * - Fail-close para operações de segurança (tokenVersion) em produção
 * - Cache invalidation por padrão de chave
 * - Suporte a serialização JSON
 */

import { getRedisClient, isRedisAvailable, openCircuitBreaker } from '@/platform/cache/redis';
import { logger } from '@/platform/logging/logger';

// Verifica se estamos em produção (fail-close para operações críticas de segurança)
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================================
// CONFIGURATION
// ============================================================================

// TTLs em segundos
export const CacheTTL = {
  /** Dados que mudam raramente (ex: roles, configurações) */
  LONG: 3600, // 1 hora

  /** Dados com atualização moderada (ex: user profile) */
  MEDIUM: 300, // 5 minutos

  /** Dados voláteis (ex: contagens, status) */
  SHORT: 60, // 1 minuto

  /** Dados de sessão */
  SESSION: 900, // 15 minutos

  /** Dados estáticos (ex: CEP, cotações) - 7 dias */
  STATIC: 604800, // 7 dias

  /** Cache de cotações (1 hora - preços podem mudar) */
  QUOTE: 3600, // 1 hora
} as const;

// Prefixos de chave para organização
// NOTA: Estes prefixos são usados internamente. Para novas implementações,
// use os key builders de @/platform/cache/keys que incluem namespace por env.
export const CachePrefix = {
  USER: 'user:',
  COLLECTOR: 'collector:',
  SHIPMENT: 'shipment:',
  QUOTE: 'quote:',
  CONFIG: 'config:',
  SESSION: 'session:',
  CEP: 'cep:',
} as const;

// Prefixo de environment para evitar colisões entre ambientes
function getEnvPrefix(): string {
  const env = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return 'prod';
  if (vercelEnv === 'preview') return 'staging';
  if (env === 'production') return 'prod';
  if (env === 'test') return 'test';
  return 'dev';
}

// Cache do prefixo
let envPrefix: string | null = null;
function getPrefix(): string {
  if (envPrefix === null) {
    envPrefix = getEnvPrefix();
  }
  return envPrefix;
}

/**
 * Adiciona prefixo de environment à chave
 * Uso: prefixKey('session:user123') => 'prod:session:user123'
 */
export function prefixKey(key: string): string {
  return `${getPrefix()}:${key}`;
}

// ============================================================================
// CORE CACHE FUNCTIONS
// ============================================================================

/**
 * Obtém valor do cache
 * Retorna null se não encontrado ou Redis indisponível
 *
 * NOTA: Chaves são automaticamente prefixadas com o environment (prod:, dev:, etc.)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const prefixedKey = prefixKey(key);
    const value = await redis.get(prefixedKey);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    openCircuitBreaker();
    logger.warn({ event: 'cache_get_error', key, err: error }, 'Cache get failed');
    return null;
  }
}

/**
 * Define valor no cache com TTL
 *
 * NOTA: Chaves são automaticamente prefixadas com o environment
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const prefixedKey = prefixKey(key);
    await redis.setex(prefixedKey, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    openCircuitBreaker();
    logger.warn({ event: 'cache_set_error', key, err: error }, 'Cache set failed');
    return false;
  }
}

/**
 * Remove valor do cache
 *
 * NOTA: Chaves são automaticamente prefixadas com o environment
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const prefixedKey = prefixKey(key);
    await redis.del(prefixedKey);
    return true;
  } catch (error) {
    openCircuitBreaker();
    logger.warn({ event: 'cache_delete_error', key, err: error }, 'Cache delete failed');
    return false;
  }
}

/**
 * Remove múltiplas chaves por padrão (usando SCAN para segurança)
 *
 * NOTA: Padrões são automaticamente prefixados com o environment
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    const redis = getRedisClient();
    const prefixedPattern = prefixKey(pattern);
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', prefixedPattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (error) {
    openCircuitBreaker();
    logger.warn({ event: 'cache_delete_pattern_error', pattern, err: error }, 'Cache pattern delete failed');
    return 0;
  }
}

// ============================================================================
// CACHE-ASIDE PATTERN (Read-through)
// ============================================================================

/**
 * Obtém valor do cache ou executa função e cacheia resultado
 * Implementa o padrão cache-aside com TTL
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<T> {
  // Tenta obter do cache
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Não encontrado, busca do source
  const value = await fetchFn();

  // Cacheia o resultado (fire and forget)
  cacheSet(key, value, ttlSeconds).catch(() => {
    // Já logado no cacheSet
  });

  return value;
}

// ============================================================================
// STAMPEDE PROTECTION (Singleflight Pattern)
// ============================================================================

// TTL do lock em ms (curto para não bloquear em caso de falha)
const LOCK_TTL_MS = 5000;
// Tempo de espera antes de tentar novamente quando lock está ocupado
const LOCK_RETRY_DELAY_MS = 50;
// Número máximo de tentativas de esperar pelo lock
const LOCK_MAX_RETRIES = 10;

/**
 * Obtém valor do cache ou executa função com proteção contra stampede
 *
 * Implementa o padrão singleflight: quando múltiplas requisições chegam
 * ao mesmo tempo para a mesma chave, apenas UMA executa o fetchFn,
 * as outras esperam o resultado ou usam fallback.
 *
 * @param key - Chave do cache
 * @param fetchFn - Função para buscar o valor quando cache miss
 * @param ttlSeconds - TTL do cache em segundos
 * @returns O valor cacheado ou buscado
 */
export async function cacheGetOrSetWithLock<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<T> {
  // Tenta obter do cache primeiro
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Se Redis não disponível, executa diretamente (sem lock)
  if (!isRedisAvailable()) {
    return fetchFn();
  }

  const lockKey = `lock:${key}`;
  const prefixedLockKey = prefixKey(lockKey);

  try {
    const redis = getRedisClient();

    // Tentar adquirir o lock (SET NX com TTL)
    const acquired = await redis.set(prefixedLockKey, '1', 'PX', LOCK_TTL_MS, 'NX');

    if (acquired === 'OK') {
      // Lock adquirido, somos responsáveis por buscar e cachear
      try {
        const value = await fetchFn();
        await cacheSet(key, value, ttlSeconds);
        return value;
      } finally {
        // Liberar lock (melhor esforço)
        await redis.del(prefixedLockKey).catch(() => {});
      }
    }

    // Lock não adquirido, outro processo está buscando
    // Esperar um pouco e tentar obter do cache
    for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
      await sleep(LOCK_RETRY_DELAY_MS);

      const result = await cacheGet<T>(key);
      if (result !== null) {
        return result;
      }

      // Verificar se o lock foi liberado (outro processo pode ter falhado)
      const lockExists = await redis.exists(prefixedLockKey);
      if (!lockExists) {
        // Lock liberado mas cache vazio, tentar adquirir novamente
        const reacquired = await redis.set(prefixedLockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
        if (reacquired === 'OK') {
          try {
            const value = await fetchFn();
            await cacheSet(key, value, ttlSeconds);
            return value;
          } finally {
            await redis.del(prefixedLockKey).catch(() => {});
          }
        }
      }
    }

    // Timeout esperando, executar diretamente como fallback
    logger.warn({ event: 'cache_lock_timeout', key }, 'Lock wait timeout, executing fetch directly');
    return fetchFn();
  } catch (error) {
    openCircuitBreaker();
    logger.warn({ event: 'cache_lock_error', key, err: error }, 'Lock operation failed, executing fetch directly');
    return fetchFn();
  }
}

/**
 * Helper para sleep/delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// STALE-WHILE-REVALIDATE (SWR) PATTERN
// ============================================================================

/**
 * Estrutura para armazenar dados com metadata de SWR
 */
interface SWRData<T> {
  value: T;
  staleAt: number; // Timestamp quando o dado fica stale
  expiresAt: number; // Timestamp quando o dado expira completamente
}

/**
 * Cache com padrão Stale-While-Revalidate
 *
 * - Retorna valor stale imediatamente enquanto revalida em background
 * - Evita que usuários esperem recompute do cache
 * - Ideal para dados que podem tolerar alguns segundos de desatualização
 *
 * @param key - Chave do cache
 * @param fetchFn - Função para buscar dados frescos
 * @param staleTTLSeconds - Tempo até o dado ficar stale (ainda válido, mas revalida em background)
 * @param maxTTLSeconds - Tempo máximo até expirar completamente
 * @returns O valor do cache ou recém-buscado
 */
export async function cacheGetOrSetSWR<T>(
  key: string,
  fetchFn: () => Promise<T>,
  staleTTLSeconds: number = 60,
  maxTTLSeconds: number = 300
): Promise<T> {
  const now = Date.now();
  const cached = await cacheGet<SWRData<T>>(key);

  if (cached) {
    // Se ainda não expirou completamente
    if (now < cached.expiresAt) {
      // Se ainda é fresh, retorna direto
      if (now < cached.staleAt) {
        return cached.value;
      }

      // Se é stale mas não expirou, retorna stale e revalida em background
      // Fire and forget - não esperamos a revalidação
      revalidateInBackground(key, fetchFn, staleTTLSeconds, maxTTLSeconds).catch((err) => {
        logger.warn({ event: 'swr_revalidate_error', key, err }, 'SWR background revalidation failed');
      });

      return cached.value;
    }
  }

  // Não tem cache ou expirou completamente - buscar sincronamente
  return fetchAndCache(key, fetchFn, staleTTLSeconds, maxTTLSeconds);
}

/**
 * Busca dados e cacheia com metadata SWR
 */
async function fetchAndCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  staleTTLSeconds: number,
  maxTTLSeconds: number
): Promise<T> {
  const value = await fetchFn();
  const now = Date.now();

  const swrData: SWRData<T> = {
    value,
    staleAt: now + staleTTLSeconds * 1000,
    expiresAt: now + maxTTLSeconds * 1000,
  };

  // Cachear com TTL máximo (o SWR é controlado pelos timestamps internos)
  await cacheSet(key, swrData, maxTTLSeconds);

  return value;
}

/**
 * Revalida cache em background (não bloqueia)
 */
async function revalidateInBackground<T>(
  key: string,
  fetchFn: () => Promise<T>,
  staleTTLSeconds: number,
  maxTTLSeconds: number
): Promise<void> {
  // Usar lock para evitar múltiplas revalidações simultâneas
  if (!isRedisAvailable()) return;

  const lockKey = `swr_lock:${key}`;
  const prefixedLockKey = prefixKey(lockKey);

  try {
    const redis = getRedisClient();
    const acquired = await redis.set(prefixedLockKey, '1', 'PX', 10000, 'NX');

    if (acquired !== 'OK') {
      // Outro processo já está revalidando
      return;
    }

    try {
      await fetchAndCache(key, fetchFn, staleTTLSeconds, maxTTLSeconds);
      logger.info({ event: 'swr_revalidated', key }, 'SWR cache revalidated in background');
    } finally {
      await redis.del(prefixedLockKey).catch(() => {});
    }
  } catch {
    // Ignora erros de revalidação em background
  }
}

// ============================================================================
// DOMAIN-SPECIFIC CACHE HELPERS
// ============================================================================

/**
 * Cache de dados do usuário
 */
export const userCache = {
  key: (userId: string) => `${CachePrefix.USER}${userId}`,

  async get<T>(userId: string): Promise<T | null> {
    return cacheGet<T>(this.key(userId));
  },

  async set<T>(userId: string, data: T): Promise<boolean> {
    return cacheSet(this.key(userId), data, CacheTTL.MEDIUM);
  },

  async invalidate(userId: string): Promise<boolean> {
    return cacheDelete(this.key(userId));
  },
};

/**
 * Dados de sessão armazenados no Redis
 */
export type SessionCacheData = {
  userId: string;
  email: string;
  role: string;
  status: string;
  tokenVersion: number;
};

// TTL para sessão: 7 dias (mesmo que refresh token)
const SESSION_TTL_SECONDS = 604800;

/**
 * Cache de sessão do usuário
 * TTL de 7 dias (mesmo que o refresh token)
 *
 * Estrutura no Redis:
 * - session:{userId} → SessionCacheData (JSON)
 * - session:{userId}:tokenVersion → número inteiro (para INCR atômico)
 */
export const sessionCache = {
  // Keys sem prefixo (cacheGet/cacheSet adicionam automaticamente)
  key: (userId: string) => `${CachePrefix.SESSION}${userId}`,
  // Keys com prefixo para uso direto com Redis
  keyPrefixed: (userId: string) => prefixKey(`${CachePrefix.SESSION}${userId}`),
  tokenVersionKey: (userId: string) => `${CachePrefix.SESSION}${userId}:tokenVersion`,
  tokenVersionKeyPrefixed: (userId: string) => prefixKey(`${CachePrefix.SESSION}${userId}:tokenVersion`),

  async get(userId: string): Promise<SessionCacheData | null> {
    return cacheGet<SessionCacheData>(this.key(userId));
  },

  async set(userId: string, data: SessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      // Salvar dados da sessão e tokenVersion separadamente (para permitir INCR)
      // Usa keys prefixadas pois acessa Redis diretamente
      await Promise.all([
        redis.setex(this.keyPrefixed(userId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKeyPrefixed(userId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
      ]);
      return true;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'session_cache_set_error', userId, err: error }, 'Failed to set session cache');
      return false;
    }
  },

  /**
   * Obtém o tokenVersion atual do Redis
   * Retorna null se não existir (usuário precisa fazer login)
   */
  async getTokenVersion(userId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const value = await redis.get(this.tokenVersionKeyPrefixed(userId));
      if (value === null) return null;
      return parseInt(value, 10);
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'session_cache_get_token_version_error', userId, err: error }, 'Failed to get tokenVersion');
      return null;
    }
  },

  /**
   * Obtém tokenVersion existente ou inicializa com 1
   * Usado no login para manter sessões existentes ou criar nova
   *
   * SECURITY: Em produção, REQUER Redis disponível (fail-close).
   * Isso previne que tokens antigos sejam aceitos se Redis estiver down.
   */
  async getOrInitTokenVersion(userId: string): Promise<number> {
    if (!isRedisAvailable()) {
      // SECURITY: Em produção, falhar se Redis não estiver disponível
      if (IS_PRODUCTION) {
        logger.error({ event: 'session_cache_redis_unavailable', userId }, 'Redis unavailable for tokenVersion in production - denying request');
        throw new Error('Authentication service temporarily unavailable');
      }
      // Em desenvolvimento, permite fallback (retorna 1)
      logger.warn({ event: 'session_cache_redis_unavailable_dev', userId }, 'Redis unavailable in dev, using default tokenVersion');
      return 1;
    }

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKeyPrefixed(userId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      // Não existe, inicializa com 1
      await redis.setex(this.tokenVersionKeyPrefixed(userId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.error({ event: 'session_cache_init_token_version_error', userId, err: error }, 'Failed to init tokenVersion');
      // SECURITY: Em produção, falhar se operação Redis falhar
      if (IS_PRODUCTION) {
        throw new Error('Authentication service temporarily unavailable');
      }
      return 1;
    }
  },

  /**
   * Incrementa tokenVersion (usado no logout)
   * Invalida todos os tokens existentes do usuário
   * Retorna o novo valor ou null se falhar
   */
  async incrementTokenVersion(userId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      // INCR atômico - cria com valor 1 se não existir
      const newVersion = await redis.incr(this.tokenVersionKeyPrefixed(userId));
      // Renovar TTL após INCR
      await redis.expire(this.tokenVersionKeyPrefixed(userId), SESSION_TTL_SECONDS);
      // NÃO deletar a sessão aqui - o refresh-handler irá atualizá-la
      // Deleção causava race condition onde a sessão era perdida entre
      // incrementTokenVersion e o set() subsequente
      return newVersion;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'session_cache_incr_error', userId, err: error }, 'Failed to increment tokenVersion');
      return null;
    }
  },

  async invalidate(userId: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      // Deletar ambas as chaves
      await redis.del(this.keyPrefixed(userId), this.tokenVersionKeyPrefixed(userId));
      return true;
    } catch (error) {
      openCircuitBreaker();
      return false;
    }
  },

  async invalidateAll(): Promise<number> {
    return cacheDeletePattern(`${CachePrefix.SESSION}*`);
  },
};

// ============================================================================
// STAFF USER SESSION CACHE (Admin)
// ============================================================================

/**
 * Dados de sessão do StaffUser (admin) armazenados no Redis
 */
export type StaffSessionCacheData = {
  staffId: string;
  email: string;
  role: string;
  status: string;
  tokenVersion: number;
};

/**
 * Cache de sessão do StaffUser (admin)
 * Mesma estratégia do sessionCache para clientes
 */
export const staffSessionCache = {
  key: (staffId: string) => `staff_session:${staffId}`,
  keyPrefixed: (staffId: string) => prefixKey(`staff_session:${staffId}`),
  tokenVersionKey: (staffId: string) => `staff_session:${staffId}:tokenVersion`,
  tokenVersionKeyPrefixed: (staffId: string) => prefixKey(`staff_session:${staffId}:tokenVersion`),

  async get(staffId: string): Promise<StaffSessionCacheData | null> {
    return cacheGet<StaffSessionCacheData>(this.key(staffId));
  },

  async set(staffId: string, data: StaffSessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.setex(this.keyPrefixed(staffId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKeyPrefixed(staffId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
      ]);
      return true;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'staff_session_cache_set_error', staffId, err: error }, 'Failed to set staff session cache');
      return false;
    }
  },

  async getTokenVersion(staffId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const value = await redis.get(this.tokenVersionKeyPrefixed(staffId));
      if (value === null) return null;
      return parseInt(value, 10);
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'staff_session_get_token_version_error', staffId, err: error }, 'Failed to get staff tokenVersion');
      return null;
    }
  },

  /**
   * SECURITY: Em produção, REQUER Redis disponível (fail-close).
   */
  async getOrInitTokenVersion(staffId: string): Promise<number> {
    if (!isRedisAvailable()) {
      if (IS_PRODUCTION) {
        logger.error({ event: 'staff_session_redis_unavailable', staffId }, 'Redis unavailable for staff tokenVersion in production');
        throw new Error('Authentication service temporarily unavailable');
      }
      return 1;
    }

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKeyPrefixed(staffId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      await redis.setex(this.tokenVersionKeyPrefixed(staffId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.error({ event: 'staff_session_init_token_version_error', staffId, err: error }, 'Failed to init staff tokenVersion');
      if (IS_PRODUCTION) {
        throw new Error('Authentication service temporarily unavailable');
      }
      return 1;
    }
  },

  async incrementTokenVersion(staffId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const newVersion = await redis.incr(this.tokenVersionKeyPrefixed(staffId));
      await redis.expire(this.tokenVersionKeyPrefixed(staffId), SESSION_TTL_SECONDS);
      // NÃO deletar a sessão aqui - o refresh-handler irá atualizá-la
      // Deleção causava race condition onde a sessão era perdida entre
      // incrementTokenVersion e o set() subsequente
      return newVersion;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'staff_session_incr_error', staffId, err: error }, 'Failed to increment staff tokenVersion');
      return null;
    }
  },

  async invalidate(staffId: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await redis.del(this.keyPrefixed(staffId), this.tokenVersionKeyPrefixed(staffId));
      return true;
    } catch (error) {
      openCircuitBreaker();
      return false;
    }
  },
};

// ============================================================================
// COLLECTOR SESSION CACHE (Coletor Autônomo)
// ============================================================================

/**
 * Dados de sessão do Collector (coletor autônomo) armazenados no Redis
 */
export type CollectorSessionCacheData = {
  collectorId: string;
  email: string | null;
  name: string;
  status: string;
  tokenVersion: number;
};

/**
 * Cache de sessão do Collector (coletor autônomo)
 * Mesma estratégia do sessionCache para clientes
 */
export const collectorSessionCache = {
  key: (collectorId: string) => `collector_session:${collectorId}`,
  keyPrefixed: (collectorId: string) => prefixKey(`collector_session:${collectorId}`),
  tokenVersionKey: (collectorId: string) => `collector_session:${collectorId}:tokenVersion`,
  tokenVersionKeyPrefixed: (collectorId: string) => prefixKey(`collector_session:${collectorId}:tokenVersion`),

  async get(collectorId: string): Promise<CollectorSessionCacheData | null> {
    return cacheGet<CollectorSessionCacheData>(this.key(collectorId));
  },

  async set(collectorId: string, data: CollectorSessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.setex(this.keyPrefixed(collectorId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKeyPrefixed(collectorId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
      ]);
      return true;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'collector_session_cache_set_error', collectorId, err: error }, 'Failed to set collector session cache');
      return false;
    }
  },

  async getTokenVersion(collectorId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const value = await redis.get(this.tokenVersionKeyPrefixed(collectorId));
      if (value === null) return null;
      return parseInt(value, 10);
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'collector_session_get_token_version_error', collectorId, err: error }, 'Failed to get collector tokenVersion');
      return null;
    }
  },

  /**
   * SECURITY: Em produção, REQUER Redis disponível (fail-close).
   */
  async getOrInitTokenVersion(collectorId: string): Promise<number> {
    if (!isRedisAvailable()) {
      if (IS_PRODUCTION) {
        logger.error({ event: 'collector_session_redis_unavailable', collectorId }, 'Redis unavailable for collector tokenVersion in production');
        throw new Error('Authentication service temporarily unavailable');
      }
      return 1;
    }

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKeyPrefixed(collectorId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      await redis.setex(this.tokenVersionKeyPrefixed(collectorId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.error({ event: 'collector_session_init_token_version_error', collectorId, err: error }, 'Failed to init collector tokenVersion');
      if (IS_PRODUCTION) {
        throw new Error('Authentication service temporarily unavailable');
      }
      return 1;
    }
  },

  async incrementTokenVersion(collectorId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const newVersion = await redis.incr(this.tokenVersionKeyPrefixed(collectorId));
      await redis.expire(this.tokenVersionKeyPrefixed(collectorId), SESSION_TTL_SECONDS);
      // NÃO deletar a sessão aqui - o refresh-handler irá atualizá-la
      // Deleção causava race condition onde a sessão era perdida entre
      // incrementTokenVersion e o set() subsequente
      return newVersion;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'collector_session_incr_error', collectorId, err: error }, 'Failed to increment collector tokenVersion');
      return null;
    }
  },

  async invalidate(collectorId: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await redis.del(this.keyPrefixed(collectorId), this.tokenVersionKeyPrefixed(collectorId));
      return true;
    } catch (error) {
      openCircuitBreaker();
      return false;
    }
  },
};

// ============================================================================
// PICKUP POINT SESSION CACHE (Ponto de Coleta)
// ============================================================================

/**
 * Dados de sessão do PickupPoint (ponto de coleta) armazenados no Redis
 */
export type PickupPointSessionCacheData = {
  pointId: string;
  cnpj: string;
  nomeFantasia: string;
  status: string;
  tokenVersion: number;
};

/**
 * Cache de sessão do PickupPoint (ponto de coleta)
 * Mesma estratégia do sessionCache para clientes
 */
export const pickupPointSessionCache = {
  key: (pointId: string) => `pickup_point_session:${pointId}`,
  keyPrefixed: (pointId: string) => prefixKey(`pickup_point_session:${pointId}`),
  tokenVersionKey: (pointId: string) => `pickup_point_session:${pointId}:tokenVersion`,
  tokenVersionKeyPrefixed: (pointId: string) => prefixKey(`pickup_point_session:${pointId}:tokenVersion`),

  async get(pointId: string): Promise<PickupPointSessionCacheData | null> {
    return cacheGet<PickupPointSessionCacheData>(this.key(pointId));
  },

  async set(pointId: string, data: PickupPointSessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.setex(this.keyPrefixed(pointId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKeyPrefixed(pointId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
      ]);
      return true;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'pickup_point_session_cache_set_error', pointId, err: error }, 'Failed to set pickup point session cache');
      return false;
    }
  },

  async getTokenVersion(pointId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const value = await redis.get(this.tokenVersionKeyPrefixed(pointId));
      if (value === null) return null;
      return parseInt(value, 10);
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'pickup_point_session_get_token_version_error', pointId, err: error }, 'Failed to get pickup point tokenVersion');
      return null;
    }
  },

  /**
   * SECURITY: Em produção, REQUER Redis disponível (fail-close).
   */
  async getOrInitTokenVersion(pointId: string): Promise<number> {
    if (!isRedisAvailable()) {
      if (IS_PRODUCTION) {
        logger.error({ event: 'pickup_point_session_redis_unavailable', pointId }, 'Redis unavailable for pickup point tokenVersion in production');
        throw new Error('Authentication service temporarily unavailable');
      }
      return 1;
    }

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKeyPrefixed(pointId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      await redis.setex(this.tokenVersionKeyPrefixed(pointId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.error({ event: 'pickup_point_session_init_token_version_error', pointId, err: error }, 'Failed to init pickup point tokenVersion');
      if (IS_PRODUCTION) {
        throw new Error('Authentication service temporarily unavailable');
      }
      return 1;
    }
  },

  async incrementTokenVersion(pointId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const newVersion = await redis.incr(this.tokenVersionKeyPrefixed(pointId));
      await redis.expire(this.tokenVersionKeyPrefixed(pointId), SESSION_TTL_SECONDS);
      // NÃO deletar a sessão aqui - o refresh-handler irá atualizá-la
      // Deleção causava race condition onde a sessão era perdida entre
      // incrementTokenVersion e o set() subsequente
      return newVersion;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'pickup_point_session_incr_error', pointId, err: error }, 'Failed to increment pickup point tokenVersion');
      return null;
    }
  },

  async invalidate(pointId: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await redis.del(this.keyPrefixed(pointId), this.tokenVersionKeyPrefixed(pointId));
      return true;
    } catch (error) {
      openCircuitBreaker();
      return false;
    }
  },
};

/**
 * Cache de configurações do sistema
 */
export const configCache = {
  key: (configKey: string) => `${CachePrefix.CONFIG}${configKey}`,

  async get<T>(configKey: string): Promise<T | null> {
    return cacheGet<T>(this.key(configKey));
  },

  async set<T>(configKey: string, data: T): Promise<boolean> {
    return cacheSet(this.key(configKey), data, CacheTTL.LONG);
  },

  async getOrSet<T>(configKey: string, fetchFn: () => Promise<T>): Promise<T> {
    return cacheGetOrSet(this.key(configKey), fetchFn, CacheTTL.LONG);
  },
};

/**
 * Cache de dados do coletor
 */
export const collectorCache = {
  key: (collectorId: string) => `${CachePrefix.COLLECTOR}${collectorId}`,

  async get<T>(collectorId: string): Promise<T | null> {
    return cacheGet<T>(this.key(collectorId));
  },

  async set<T>(collectorId: string, data: T): Promise<boolean> {
    return cacheSet(this.key(collectorId), data, CacheTTL.MEDIUM);
  },

  async invalidate(collectorId: string): Promise<boolean> {
    return cacheDelete(this.key(collectorId));
  },
};

// ============================================================================
// CACHE STATISTICS (para monitoramento)
// ============================================================================

let cacheHits = 0;
let cacheMisses = 0;

/**
 * Obtém estatísticas do cache
 */
export function getCacheStats(): {
  hits: number;
  misses: number;
  hitRate: number;
} {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
}

/**
 * Reseta estatísticas do cache
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Versão de cacheGet com tracking de estatísticas
 */
export async function cacheGetWithStats<T>(key: string): Promise<T | null> {
  const value = await cacheGet<T>(key);
  if (value !== null) {
    cacheHits++;
  } else {
    cacheMisses++;
  }
  return value;
}

// ============================================================================
// CEP CACHE HELPER
// ============================================================================

/**
 * Cache de CEPs
 * CEP é dado estático, usando TTL longo (7 dias)
 */
export const cepCache = {
  key: (cep: string) => `${CachePrefix.CEP}${cep.replace(/\D/g, '')}`,

  async get<T>(cep: string): Promise<T | null> {
    return cacheGet<T>(this.key(cep));
  },

  async set<T>(cep: string, data: T): Promise<boolean> {
    return cacheSet(this.key(cep), data, CacheTTL.STATIC);
  },

  async getOrSet<T>(cep: string, fetchFn: () => Promise<T>): Promise<T> {
    return cacheGetOrSet(this.key(cep), fetchFn, CacheTTL.STATIC);
  },
};

// ============================================================================
// QUOTE CACHE HELPER
// ============================================================================

/**
 * Parâmetros para gerar cache key de cotação
 */
export type QuoteCacheParams = {
  originCep: string;
  destinationCep: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  carrier?: string;
};

/**
 * Gera chave de cache para cotação
 */
function generateQuoteCacheKey(params: QuoteCacheParams): string {
  const parts: (string | number)[] = [
    CachePrefix.QUOTE,
    params.originCep.replace(/\D/g, ''),
    params.destinationCep.replace(/\D/g, ''),
    Math.round(params.weight * 100), // Peso em gramas
  ];

  // Incluir dimensões se fornecidas
  if (params.length && params.width && params.height) {
    parts.push(`${params.length}x${params.width}x${params.height}`);
  }

  // Incluir transportadora se específica
  if (params.carrier) {
    parts.push(params.carrier.toLowerCase());
  }

  return parts.join(':');
}

/**
 * Cache de cotações de frete
 * Cotações podem mudar, usando TTL de 1 hora
 */
export const quoteCache = {
  key: generateQuoteCacheKey,

  async get<T>(params: QuoteCacheParams): Promise<T | null> {
    return cacheGet<T>(generateQuoteCacheKey(params));
  },

  async set<T>(params: QuoteCacheParams, data: T): Promise<boolean> {
    return cacheSet(generateQuoteCacheKey(params), data, CacheTTL.QUOTE);
  },

  async getOrSet<T>(
    params: QuoteCacheParams,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    return cacheGetOrSet(generateQuoteCacheKey(params), fetchFn, CacheTTL.QUOTE);
  },

  async invalidateForCep(cep: string): Promise<number> {
    const normalized = cep.replace(/\D/g, '');
    return cacheDeletePattern(`${CachePrefix.QUOTE}*${normalized}*`);
  },
};

// ============================================================================
// FAQ CACHE HELPER
// ============================================================================

/**
 * Cache de FAQs públicos
 * Invalidação manual quando admin atualiza
 */
export const faqCache = {
  keyPrefix: 'faq:',

  /**
   * Invalida todo o cache de FAQ (chamado após criar/editar/deletar)
   */
  async invalidateAll(): Promise<number> {
    return cacheDeletePattern('faq:*');
  },
};

// ============================================================================
// PICKUP POINTS CACHE HELPER
// ============================================================================

/**
 * Cache de pontos de coleta
 * Invalidação manual quando admin atualiza
 */
export const pickupPointsCache = {
  keyPrefix: 'pickup-points:',

  /**
   * Invalida todo o cache de pontos de coleta
   */
  async invalidateAll(): Promise<number> {
    return cacheDeletePattern('pickup-points:*');
  },

  /**
   * Invalida cache por UF específico
   */
  async invalidateByUf(uf: string): Promise<number> {
    return cacheDeletePattern(`pickup-points:${uf.toUpperCase()}:*`);
  },
};

// ============================================================================
// CORREIOS AGENCIES CACHE HELPER
// ============================================================================

/**
 * Cache de agências dos Correios por proximidade
 * Dados estáticos - TTL de 7 dias
 * Usa stampede protection pois múltiplas requisições podem
 * chegar simultaneamente para o mesmo CEP
 */
export const agenciesCache = {
  key: (cep5: string) => `agencies:${cep5.replace(/\D/g, '').slice(0, 5)}`,

  async get<T>(cep: string): Promise<T | null> {
    return cacheGet<T>(this.key(cep));
  },

  async set<T>(cep: string, data: T): Promise<boolean> {
    return cacheSet(this.key(cep), data, CacheTTL.STATIC);
  },

  /**
   * Busca agências com proteção contra stampede
   * Múltiplas requisições simultâneas para o mesmo CEP
   * resultam em apenas uma chamada à API
   */
  async getOrSetWithLock<T>(cep: string, fetchFn: () => Promise<T>): Promise<T> {
    return cacheGetOrSetWithLock(this.key(cep), fetchFn, CacheTTL.STATIC);
  },

  async invalidate(cep: string): Promise<boolean> {
    return cacheDelete(this.key(cep));
  },
};

// ============================================================================
// FIPE CACHE HELPER
// ============================================================================

/**
 * Cache de dados FIPE (marcas e modelos de veículos)
 * Dados estáticos - TTL de 7 dias
 * Usa stampede protection pois é dado compartilhado
 */
export const fipeCache = {
  brandsKey: () => 'fipe:brands',
  modelsKey: (brandId: string) => `fipe:models:${brandId}`,

  /**
   * Busca marcas de veículos com proteção contra stampede
   */
  async getBrands<T>(fetchFn: () => Promise<T>): Promise<T> {
    return cacheGetOrSetWithLock(this.brandsKey(), fetchFn, CacheTTL.STATIC);
  },

  /**
   * Busca modelos de uma marca com proteção contra stampede
   */
  async getModels<T>(brandId: string, fetchFn: () => Promise<T>): Promise<T> {
    return cacheGetOrSetWithLock(this.modelsKey(brandId), fetchFn, CacheTTL.STATIC);
  },

  /**
   * Invalida todo o cache FIPE (após sync)
   */
  async invalidateAll(): Promise<number> {
    return cacheDeletePattern('fipe:*');
  },

  /**
   * Invalida modelos de uma marca específica
   */
  async invalidateModels(brandId: string): Promise<boolean> {
    return cacheDelete(this.modelsKey(brandId));
  },
};

// ============================================================================
// USER SHIPMENTS CACHE HELPER
// ============================================================================

/**
 * Cache de listagem de shipments do usuário
 * Usa SWR para retornar dados stale enquanto revalida em background
 * - staleTTL: 30 segundos (dados podem ficar 30s desatualizados)
 * - maxTTL: 5 minutos (após 5 min, força busca síncrona)
 */
export const shipmentsCache = {
  /**
   * Gera chave baseada em userId + filtros + paginação
   * Isso permite cache diferenciado por contexto de busca
   */
  key: (userId: string, filters: { q?: string; status?: string }, page: number, limit: number) => {
    const parts = ['shipments', userId, page.toString(), limit.toString()];
    if (filters.q) parts.push(`q:${filters.q}`);
    if (filters.status && filters.status !== 'Todos') parts.push(`s:${filters.status}`);
    return parts.join(':');
  },

  /**
   * Busca shipments com SWR - retorna stale imediatamente, revalida em background
   */
  async getOrSetSWR<T>(
    userId: string,
    filters: { q?: string; status?: string },
    page: number,
    limit: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const key = this.key(userId, filters, page, limit);
    // staleTTL: 30s - pode mostrar dados de até 30s atrás
    // maxTTL: 5min - após 5min, busca síncrona obrigatória
    return cacheGetOrSetSWR(key, fetchFn, 30, 300);
  },

  /**
   * Invalida todo o cache de shipments de um usuário
   * Chamado quando há mudança de status, novo shipment, etc.
   */
  async invalidateUser(userId: string): Promise<number> {
    return cacheDeletePattern(`shipments:${userId}:*`);
  },

  /**
   * Invalida cache de um shipment específico
   * Útil para invalidar após update de um envio
   */
  async invalidateShipment(shipmentId: string): Promise<boolean> {
    return cacheDelete(`shipment:${shipmentId}`);
  },
};

// ============================================================================
// ADMIN TICKETS CACHE HELPER
// ============================================================================

/**
 * Cache de listagem de tickets para admin
 * Usa SWR para não bloquear UI do admin enquanto busca dados atualizados
 * - staleTTL: 15 segundos (tickets podem mudar rapidamente)
 * - maxTTL: 2 minutos
 */
export const ticketsCache = {
  /**
   * Gera chave baseada em filtros + paginação
   */
  key: (filters: { status?: string[]; priority?: string[]; query?: string; assignedTo?: string | null }, page: number, pageSize: number) => {
    const parts = ['tickets', 'admin', page.toString(), pageSize.toString()];
    if (filters.status?.length) parts.push(`st:${filters.status.join(',')}`);
    if (filters.priority?.length) parts.push(`pr:${filters.priority.join(',')}`);
    if (filters.query) parts.push(`q:${filters.query}`);
    if (filters.assignedTo !== undefined) parts.push(`as:${filters.assignedTo ?? 'null'}`);
    return parts.join(':');
  },

  /**
   * Busca tickets com SWR
   */
  async getOrSetSWR<T>(
    filters: { status?: string[]; priority?: string[]; query?: string; assignedTo?: string | null },
    page: number,
    pageSize: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const key = this.key(filters, page, pageSize);
    // staleTTL: 15s - tickets podem mudar mais rápido
    // maxTTL: 2min
    return cacheGetOrSetSWR(key, fetchFn, 15, 120);
  },

  /**
   * Invalida todo o cache de tickets admin
   * Chamado quando há nova mensagem, mudança de status, etc.
   */
  async invalidateAll(): Promise<number> {
    return cacheDeletePattern('tickets:admin:*');
  },
};

// ============================================================================
// OPS KPIS CACHE HELPER
// ============================================================================

/**
 * Cache de KPIs do dashboard de operações
 * Usa SWR para UI responsiva - mostra dados stale enquanto atualiza
 * - staleTTL: 30 segundos (KPIs agregados podem ser ligeiramente desatualizados)
 * - maxTTL: 3 minutos
 */
export const kpisCache = {
  key: () => 'kpis:ops',

  /**
   * Busca KPIs com SWR
   */
  async getOrSetSWR<T>(fetchFn: () => Promise<T>): Promise<T> {
    // staleTTL: 30s, maxTTL: 3min
    return cacheGetOrSetSWR(this.key(), fetchFn, 30, 180);
  },

  /**
   * Invalida cache de KPIs
   * Chamado após mudança significativa de status de shipments
   */
  async invalidate(): Promise<boolean> {
    return cacheDelete(this.key());
  },
};

// ============================================================================
// SYSTEM CONFIG CACHE HELPER
// ============================================================================

/**
 * Cache de configurações do sistema (email, openrouter, comissões, etc.)
 * TTL de 1 hora com invalidação explícita após updates
 */
export const systemConfigCache = {
  key: (configType: string) => `sysconfig:${configType}`,

  async get<T>(configType: string): Promise<T | null> {
    return cacheGet<T>(this.key(configType));
  },

  async set<T>(configType: string, data: T): Promise<boolean> {
    return cacheSet(this.key(configType), data, CacheTTL.LONG);
  },

  async getOrSet<T>(configType: string, fetchFn: () => Promise<T>): Promise<T> {
    return cacheGetOrSet(this.key(configType), fetchFn, CacheTTL.LONG);
  },

  /**
   * Invalida config específica (chamado após admin update)
   */
  async invalidate(configType: string): Promise<boolean> {
    return cacheDelete(this.key(configType));
  },

  /**
   * Invalida todas as configs do sistema
   */
  async invalidateAll(): Promise<number> {
    return cacheDeletePattern('sysconfig:*');
  },
};
