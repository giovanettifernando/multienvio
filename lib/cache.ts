/**
 * Redis Cache Utility
 *
 * Fornece cache para dados frequentemente acessados com:
 * - TTL configurável
 * - Fail-open (fallback se Redis indisponível)
 * - Cache invalidation por padrão de chave
 * - Suporte a serialização JSON
 */

import { getRedisClient, isRedisAvailable, openCircuitBreaker } from './redis';
import { logger } from './logger';

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
export const CachePrefix = {
  USER: 'user:',
  ROLE: 'role:',
  COLLECTOR: 'collector:',
  SHIPMENT: 'shipment:',
  QUOTE: 'quote:',
  CONFIG: 'config:',
  SESSION: 'session:',
  CEP: 'cep:',
} as const;

// ============================================================================
// CORE CACHE FUNCTIONS
// ============================================================================

/**
 * Obtém valor do cache
 * Retorna null se não encontrado ou Redis indisponível
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const value = await redis.get(key);

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
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    openCircuitBreaker();
    logger.warn({ event: 'cache_set_error', key, err: error }, 'Cache set failed');
    return false;
  }
}

/**
 * Remove valor do cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    await redis.del(key);
    return true;
  } catch (error) {
    openCircuitBreaker();
    logger.warn({ event: 'cache_delete_error', key, err: error }, 'Cache delete failed');
    return false;
  }
}

/**
 * Remove múltiplas chaves por padrão (usando SCAN para segurança)
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    const redis = getRedisClient();
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
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
  key: (userId: string) => `${CachePrefix.SESSION}${userId}`,
  tokenVersionKey: (userId: string) => `${CachePrefix.SESSION}${userId}:tokenVersion`,

  async get(userId: string): Promise<SessionCacheData | null> {
    return cacheGet<SessionCacheData>(this.key(userId));
  },

  async set(userId: string, data: SessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      // Salvar dados da sessão e tokenVersion separadamente (para permitir INCR)
      await Promise.all([
        redis.setex(this.key(userId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKey(userId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
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
      const value = await redis.get(this.tokenVersionKey(userId));
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
   */
  async getOrInitTokenVersion(userId: string): Promise<number> {
    if (!isRedisAvailable()) {
      // Se Redis indisponível, retorna 1 (nova sessão)
      return 1;
    }

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKey(userId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      // Não existe, inicializa com 1
      await redis.setex(this.tokenVersionKey(userId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'session_cache_init_token_version_error', userId, err: error }, 'Failed to init tokenVersion');
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
      const newVersion = await redis.incr(this.tokenVersionKey(userId));
      // Renovar TTL após INCR
      await redis.expire(this.tokenVersionKey(userId), SESSION_TTL_SECONDS);
      // Deletar dados da sessão (força re-fetch no próximo login)
      await redis.del(this.key(userId));
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
      await redis.del(this.key(userId), this.tokenVersionKey(userId));
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
  tokenVersionKey: (staffId: string) => `staff_session:${staffId}:tokenVersion`,

  async get(staffId: string): Promise<StaffSessionCacheData | null> {
    return cacheGet<StaffSessionCacheData>(this.key(staffId));
  },

  async set(staffId: string, data: StaffSessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.setex(this.key(staffId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKey(staffId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
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
      const value = await redis.get(this.tokenVersionKey(staffId));
      if (value === null) return null;
      return parseInt(value, 10);
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'staff_session_get_token_version_error', staffId, err: error }, 'Failed to get staff tokenVersion');
      return null;
    }
  },

  async getOrInitTokenVersion(staffId: string): Promise<number> {
    if (!isRedisAvailable()) return 1;

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKey(staffId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      await redis.setex(this.tokenVersionKey(staffId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'staff_session_init_token_version_error', staffId, err: error }, 'Failed to init staff tokenVersion');
      return 1;
    }
  },

  async incrementTokenVersion(staffId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const newVersion = await redis.incr(this.tokenVersionKey(staffId));
      await redis.expire(this.tokenVersionKey(staffId), SESSION_TTL_SECONDS);
      await redis.del(this.key(staffId));
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
      await redis.del(this.key(staffId), this.tokenVersionKey(staffId));
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
  tokenVersionKey: (collectorId: string) => `collector_session:${collectorId}:tokenVersion`,

  async get(collectorId: string): Promise<CollectorSessionCacheData | null> {
    return cacheGet<CollectorSessionCacheData>(this.key(collectorId));
  },

  async set(collectorId: string, data: CollectorSessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.setex(this.key(collectorId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKey(collectorId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
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
      const value = await redis.get(this.tokenVersionKey(collectorId));
      if (value === null) return null;
      return parseInt(value, 10);
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'collector_session_get_token_version_error', collectorId, err: error }, 'Failed to get collector tokenVersion');
      return null;
    }
  },

  async getOrInitTokenVersion(collectorId: string): Promise<number> {
    if (!isRedisAvailable()) return 1;

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKey(collectorId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      await redis.setex(this.tokenVersionKey(collectorId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'collector_session_init_token_version_error', collectorId, err: error }, 'Failed to init collector tokenVersion');
      return 1;
    }
  },

  async incrementTokenVersion(collectorId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const newVersion = await redis.incr(this.tokenVersionKey(collectorId));
      await redis.expire(this.tokenVersionKey(collectorId), SESSION_TTL_SECONDS);
      await redis.del(this.key(collectorId));
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
      await redis.del(this.key(collectorId), this.tokenVersionKey(collectorId));
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
  tokenVersionKey: (pointId: string) => `pickup_point_session:${pointId}:tokenVersion`,

  async get(pointId: string): Promise<PickupPointSessionCacheData | null> {
    return cacheGet<PickupPointSessionCacheData>(this.key(pointId));
  },

  async set(pointId: string, data: PickupPointSessionCacheData): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.setex(this.key(pointId), SESSION_TTL_SECONDS, JSON.stringify(data)),
        redis.setex(this.tokenVersionKey(pointId), SESSION_TTL_SECONDS, data.tokenVersion.toString()),
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
      const value = await redis.get(this.tokenVersionKey(pointId));
      if (value === null) return null;
      return parseInt(value, 10);
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'pickup_point_session_get_token_version_error', pointId, err: error }, 'Failed to get pickup point tokenVersion');
      return null;
    }
  },

  async getOrInitTokenVersion(pointId: string): Promise<number> {
    if (!isRedisAvailable()) return 1;

    try {
      const redis = getRedisClient();
      const existing = await redis.get(this.tokenVersionKey(pointId));

      if (existing !== null) {
        return parseInt(existing, 10);
      }

      await redis.setex(this.tokenVersionKey(pointId), SESSION_TTL_SECONDS, '1');
      return 1;
    } catch (error) {
      openCircuitBreaker();
      logger.warn({ event: 'pickup_point_session_init_token_version_error', pointId, err: error }, 'Failed to init pickup point tokenVersion');
      return 1;
    }
  },

  async incrementTokenVersion(pointId: string): Promise<number | null> {
    if (!isRedisAvailable()) return null;

    try {
      const redis = getRedisClient();
      const newVersion = await redis.incr(this.tokenVersionKey(pointId));
      await redis.expire(this.tokenVersionKey(pointId), SESSION_TTL_SECONDS);
      await redis.del(this.key(pointId));
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
      await redis.del(this.key(pointId), this.tokenVersionKey(pointId));
      return true;
    } catch (error) {
      openCircuitBreaker();
      return false;
    }
  },
};

// ============================================================================
// ROLE CACHE
// ============================================================================

/**
 * Cache de roles (raramente mudam)
 */
export const roleCache = {
  key: (roleId: string) => `${CachePrefix.ROLE}${roleId}`,
  keyByName: (name: string) => `${CachePrefix.ROLE}name:${name}`,

  async get<T>(roleId: string): Promise<T | null> {
    return cacheGet<T>(this.key(roleId));
  },

  async getByName<T>(name: string): Promise<T | null> {
    return cacheGet<T>(this.keyByName(name));
  },

  async set<T>(roleId: string, data: T & { name?: string }): Promise<boolean> {
    const result = await cacheSet(this.key(roleId), data, CacheTTL.LONG);
    // Também cacheia por nome se disponível
    if (data.name) {
      await cacheSet(this.keyByName(data.name), data, CacheTTL.LONG);
    }
    return result;
  },

  async invalidateAll(): Promise<number> {
    return cacheDeletePattern(`${CachePrefix.ROLE}*`);
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
// DOMAIN HELPERS - Require prisma lazily to avoid circular dependencies
// ============================================================================

/**
 * Busca role por nome com cache
 * Ideal para lookups frequentes como 'user', 'admin'
 */
export async function getCachedRoleByName(
  name: string
): Promise<{ id: string; name: string } | null> {
  const cacheKey = roleCache.keyByName(name);

  // Tenta cache primeiro
  const cached = await roleCache.getByName<{ id: string; name: string }>(name);
  if (cached) {
    return cached;
  }

  // Importação lazy do prisma para evitar dependência circular
  const { prisma } = await import('./db');

  // Busca do banco
  const role = await prisma.role.findUnique({
    where: { name },
    select: { id: true, name: true },
  });

  if (role) {
    // Cacheia para próximas requisições
    await roleCache.set(role.id, role);
  }

  return role;
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
