/**
 * Cache Metrics - Tracking de Hit/Miss
 *
 * Fornece métricas de performance do cache para observabilidade.
 * Em produção, estas métricas podem ser exportadas para Prometheus/Datadog.
 */

import { logger } from '@/platform/logging/logger';

// ============================================================================
// TYPES
// ============================================================================

export type CacheType =
  | 'session'
  | 'staff_session'
  | 'collector_session'
  | 'pickup_point_session'
  | 'idempotency'
  | 'cep'
  | 'quote'
  | 'config'
  | 'agencies'
  | 'fipe'
  | 'sysconfig'
  | 'shipments'
  | 'tickets'
  | 'kpis'
  | 'other';

export type CacheOperation = 'get' | 'set' | 'delete';

interface CacheMetric {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalLatencyMs: number;
  operationCount: number;
}

// ============================================================================
// METRICS STORAGE
// ============================================================================

// Métricas por tipo de cache
const metrics = new Map<CacheType, CacheMetric>();

// Inicializar métricas para um tipo
function initMetric(type: CacheType): CacheMetric {
  return {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    totalLatencyMs: 0,
    operationCount: 0,
  };
}

// Obter ou criar métrica
function getMetric(type: CacheType): CacheMetric {
  let metric = metrics.get(type);
  if (!metric) {
    metric = initMetric(type);
    metrics.set(type, metric);
  }
  return metric;
}

// ============================================================================
// METRIC RECORDING FUNCTIONS
// ============================================================================

/**
 * Registra um cache hit
 */
export function recordCacheHit(type: CacheType, latencyMs?: number): void {
  const metric = getMetric(type);
  metric.hits++;
  metric.operationCount++;
  if (latencyMs !== undefined) {
    metric.totalLatencyMs += latencyMs;
  }
}

/**
 * Registra um cache miss
 */
export function recordCacheMiss(type: CacheType, latencyMs?: number): void {
  const metric = getMetric(type);
  metric.misses++;
  metric.operationCount++;
  if (latencyMs !== undefined) {
    metric.totalLatencyMs += latencyMs;
  }
}

/**
 * Registra uma operação de set
 */
export function recordCacheSet(type: CacheType, latencyMs?: number): void {
  const metric = getMetric(type);
  metric.sets++;
  metric.operationCount++;
  if (latencyMs !== undefined) {
    metric.totalLatencyMs += latencyMs;
  }
}

/**
 * Registra uma operação de delete
 */
export function recordCacheDelete(type: CacheType, latencyMs?: number): void {
  const metric = getMetric(type);
  metric.deletes++;
  metric.operationCount++;
  if (latencyMs !== undefined) {
    metric.totalLatencyMs += latencyMs;
  }
}

/**
 * Registra um erro de cache
 */
export function recordCacheError(type: CacheType): void {
  const metric = getMetric(type);
  metric.errors++;
}

// ============================================================================
// METRIC RETRIEVAL
// ============================================================================

export interface CacheStats {
  type: CacheType;
  hits: number;
  misses: number;
  hitRate: number;
  sets: number;
  deletes: number;
  errors: number;
  avgLatencyMs: number;
  operationCount: number;
}

/**
 * Obtém estatísticas de um tipo específico de cache
 */
export function getCacheStats(type: CacheType): CacheStats {
  const metric = getMetric(type);
  const total = metric.hits + metric.misses;

  return {
    type,
    hits: metric.hits,
    misses: metric.misses,
    hitRate: total > 0 ? metric.hits / total : 0,
    sets: metric.sets,
    deletes: metric.deletes,
    errors: metric.errors,
    avgLatencyMs: metric.operationCount > 0 ? metric.totalLatencyMs / metric.operationCount : 0,
    operationCount: metric.operationCount,
  };
}

/**
 * Obtém estatísticas de todos os tipos de cache
 */
export function getAllCacheStats(): CacheStats[] {
  const allStats: CacheStats[] = [];

  for (const [type] of metrics) {
    allStats.push(getCacheStats(type));
  }

  return allStats;
}

/**
 * Obtém estatísticas agregadas de todo o cache
 */
export function getAggregatedCacheStats(): {
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  totalOperations: number;
  totalErrors: number;
  avgLatencyMs: number;
} {
  let totalHits = 0;
  let totalMisses = 0;
  let totalOperations = 0;
  let totalErrors = 0;
  let totalLatencyMs = 0;

  for (const [, metric] of metrics) {
    totalHits += metric.hits;
    totalMisses += metric.misses;
    totalOperations += metric.operationCount;
    totalErrors += metric.errors;
    totalLatencyMs += metric.totalLatencyMs;
  }

  const totalAttempts = totalHits + totalMisses;

  return {
    totalHits,
    totalMisses,
    overallHitRate: totalAttempts > 0 ? totalHits / totalAttempts : 0,
    totalOperations,
    totalErrors,
    avgLatencyMs: totalOperations > 0 ? totalLatencyMs / totalOperations : 0,
  };
}

/**
 * Reseta todas as métricas (útil para testes)
 */
export function resetAllMetrics(): void {
  metrics.clear();
}

/**
 * Reseta métricas de um tipo específico
 */
export function resetMetrics(type: CacheType): void {
  metrics.delete(type);
}

// ============================================================================
// LOGGING / EXPORT
// ============================================================================

/**
 * Loga métricas de cache (para debugging ou monitoramento)
 */
export function logCacheMetrics(): void {
  const stats = getAllCacheStats();
  const aggregated = getAggregatedCacheStats();

  logger.info(
    {
      event: 'cache_metrics',
      aggregated,
      byType: stats,
    },
    `Cache metrics: ${aggregated.overallHitRate.toFixed(2)}% hit rate, ${aggregated.totalOperations} ops`
  );
}

/**
 * Exporta métricas em formato Prometheus
 * Uso: expor via endpoint /metrics
 */
export function exportPrometheusMetrics(): string {
  const lines: string[] = [];

  // Header
  lines.push('# HELP cache_hits_total Total number of cache hits');
  lines.push('# TYPE cache_hits_total counter');

  lines.push('# HELP cache_misses_total Total number of cache misses');
  lines.push('# TYPE cache_misses_total counter');

  lines.push('# HELP cache_operations_total Total number of cache operations');
  lines.push('# TYPE cache_operations_total counter');

  lines.push('# HELP cache_errors_total Total number of cache errors');
  lines.push('# TYPE cache_errors_total counter');

  lines.push('# HELP cache_latency_seconds_sum Sum of cache operation latencies');
  lines.push('# TYPE cache_latency_seconds_sum counter');

  // Métricas por tipo
  for (const [type, metric] of metrics) {
    lines.push(`cache_hits_total{type="${type}"} ${metric.hits}`);
    lines.push(`cache_misses_total{type="${type}"} ${metric.misses}`);
    lines.push(`cache_operations_total{type="${type}"} ${metric.operationCount}`);
    lines.push(`cache_errors_total{type="${type}"} ${metric.errors}`);
    lines.push(`cache_latency_seconds_sum{type="${type}"} ${metric.totalLatencyMs / 1000}`);
  }

  return lines.join('\n');
}

// ============================================================================
// HIGH-LEVEL TRACKING WRAPPER
// ============================================================================

/**
 * Wrapper para medir e registrar uma operação de cache
 */
export async function trackCacheOperation<T>(
  type: CacheType,
  operation: 'get' | 'set' | 'delete',
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();
    const latencyMs = Date.now() - start;

    // Para operações get, determinar hit/miss pelo resultado
    if (operation === 'get') {
      if (result !== null && result !== undefined) {
        recordCacheHit(type, latencyMs);
      } else {
        recordCacheMiss(type, latencyMs);
      }
    } else if (operation === 'set') {
      recordCacheSet(type, latencyMs);
    } else if (operation === 'delete') {
      recordCacheDelete(type, latencyMs);
    }

    return result;
  } catch (error) {
    recordCacheError(type);
    throw error;
  }
}
