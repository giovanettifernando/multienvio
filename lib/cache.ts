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
