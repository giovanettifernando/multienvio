import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, isRedisAvailable, openCircuitBreaker, waitForRedisConnection } from '@/platform/cache/redis';
import { ApiError } from '@/platform/api/errors';

// ============================================================================
// RATE LIMIT DISTRIBUIDO COM REDIS
// Estrategia: FAIL-OPEN com fallback local
// Se Redis falhar, nao bloqueia usuario - usa rate limit em memoria local
// ============================================================================

interface RateLimitConfig {
  windowMs: number;    // Janela de tempo em ms
  maxRequests: number; // Maximo de requisicoes na janela
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  fromRedis: boolean;  // true se veio do Redis, false se fallback local
}

// ============================================================================
// FALLBACK LOCAL (Memoria)
// Usado quando Redis esta indisponivel
// ============================================================================

interface LocalRequestLog {
  count: number;
  resetTime: number;
}

const localRequestLogs = new Map<string, LocalRequestLog>();

// Limpeza periodica de logs expirados (a cada 5 minutos)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, log] of localRequestLogs.entries()) {
      if (now > log.resetTime) {
        localRequestLogs.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function checkLocalRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const log = localRequestLogs.get(key);

  // Se nao ha log ou o tempo resetou, criar novo
  if (!log || now > log.resetTime) {
    localRequestLogs.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      fromRedis: false,
    };
  }

  // Se atingiu o limite
  if (log.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: log.resetTime,
      fromRedis: false,
    };
  }

  // Incrementar contador
  log.count += 1;
  localRequestLogs.set(key, log);

  return {
    allowed: true,
    remaining: config.maxRequests - log.count,
    resetTime: log.resetTime,
    fromRedis: false,
  };
}

// ============================================================================
// RATE LIMIT COM REDIS (Sliding Window)
// ============================================================================

async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const redisKey = `ratelimit:${key}`;

  // Usar Lua script para operacao atomica (sliding window)
  const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_start = tonumber(ARGV[2])
    local max_requests = tonumber(ARGV[3])
    local window_ms = tonumber(ARGV[4])

    -- Remove timestamps antigos
    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

    -- Conta requisicoes na janela
    local count = redis.call('ZCARD', key)

    if count >= max_requests then
      -- Limite excedido
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local reset_time = now + window_ms
      if oldest and oldest[2] then
        reset_time = tonumber(oldest[2]) + window_ms
      end
      return {0, max_requests - count, reset_time}
    end

    -- Adiciona timestamp atual
    redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))

    -- Define expiracao para limpeza automatica
    redis.call('PEXPIRE', key, window_ms)

    return {1, max_requests - count - 1, now + window_ms}
  `;

  const result = await redis.eval(
    luaScript,
    1,
    redisKey,
    now.toString(),
    windowStart.toString(),
    config.maxRequests.toString(),
    config.windowMs.toString()
  ) as [number, number, number];

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    resetTime: result[2],
    fromRedis: true,
  };
}

// ============================================================================
// FUNCAO PRINCIPAL - FAIL-OPEN
// ============================================================================

/**
 * Verifica rate limit com estrategia fail-open
 * Se Redis falhar, usa fallback local
 * NOTA: Para rotas sensíveis (login, reset, checkout), use checkRateLimitStrict
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Se Redis nao esta disponivel, usa fallback local imediatamente
  if (!isRedisAvailable()) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[RateLimit] Redis indisponivel, usando fallback local para: ${key}`);
    }
    return checkLocalRateLimit(key, config);
  }

  try {
    return await checkRedisRateLimit(key, config);
  } catch (error) {
    // FAIL-OPEN: Redis falhou, abre circuit breaker e usa fallback local
    openCircuitBreaker();

    if (process.env.NODE_ENV === 'production') {
      console.warn(
        `[RateLimit] Redis falhou, usando fallback local. Erro: ${(error as Error).message}`
      );
    }

    return checkLocalRateLimit(key, config);
  }
}

/**
 * Verifica rate limit com estrategia fail-close (SEGURO)
 * PRODUÇÃO: Se Redis falhar, BLOQUEIA a requisição (não permite fallback local)
 * DESENVOLVIMENTO: Se Redis falhar, usa fallback local (para não bloquear dev)
 * Use para rotas sensíveis: login, reset-password, checkout
 */
export async function checkRateLimitStrict(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult & { redisUnavailable?: boolean }> {
  const isProduction = process.env.NODE_ENV === 'production';

  // Aguardar conexão inicial do Redis (com timeout de 2s)
  // Isso evita falsos positivos de "Redis indisponível" na primeira requisição
  await waitForRedisConnection();

  // Se Redis nao esta disponivel após aguardar
  if (!isRedisAvailable()) {
    // Em produção: bloquear (fail-close)
    if (isProduction) {
      console.error(`[RateLimit][STRICT] Redis indisponivel - bloqueando requisição para: ${key}`);
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000, // Retry em 1 minuto
        fromRedis: false,
        redisUnavailable: true,
      };
    }
    // Em desenvolvimento: usar fallback local (sem log excessivo)
    return checkLocalRateLimit(key, config);
  }

  try {
    return await checkRedisRateLimit(key, config);
  } catch (error) {
    openCircuitBreaker();
    // Em produção: bloquear (fail-close)
    if (isProduction) {
      console.error(
        `[RateLimit][STRICT] Redis falhou - bloqueando requisição. Erro: ${(error as Error).message}`
      );
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        fromRedis: false,
        redisUnavailable: true,
      };
    }
    // Em desenvolvimento: usar fallback local
    console.warn(
      `[RateLimit][STRICT] Redis falhou em dev - usando fallback local. Erro: ${(error as Error).message}`
    );
    return checkLocalRateLimit(key, config);
  }
}

// ============================================================================
// HELPERS PARA ROTAS
// ============================================================================

/**
 * Rate limit por usuario autenticado
 */
export async function rateLimitByUser(
  userId: string,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }
): Promise<NextResponse | null> {
  const result = await checkRateLimit(`user:${userId}:${action}`, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    return NextResponse.json(
      {
        message: 'Muitas requisicoes. Tente novamente mais tarde.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Rate limit por IP
 */
export async function rateLimitByIP(
  request: NextRequest,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 5 }
): Promise<NextResponse | null> {
  const TRUSTED_PROXY_ENABLED = process.env.TRUST_PROXY === 'true';
  let ip: string | null = null;

  if (TRUSTED_PROXY_ENABLED) {
    // Apenas confiar em headers de proxy se explicitamente habilitado
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    ip = forwarded ? forwarded.split(',')[0].trim() : realIp;
  }
  // NOTA: NÃO usar x-real-ip se TRUST_PROXY não estiver habilitado (evita spoofing)

  // Se nao conseguir identificar IP, usar bucket global mais restritivo
  if (!ip) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[RateLimit] IP nao identificado para action '${action}', usando bucket global`);
    }
    const globalConfig = { ...config, maxRequests: Math.ceil(config.maxRequests / 2) };
    const result = await checkRateLimit(`global:${action}`, globalConfig);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        { message: 'Muitas requisicoes. Tente novamente mais tarde.', retryAfter },
        { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
      );
    }
    return null;
  }

  const result = await checkRateLimit(`ip:${ip}:${action}`, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    return NextResponse.json(
      {
        message: 'Muitas requisicoes. Tente novamente mais tarde.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Rate limit por IP - STRICT (fail-close)
 * Se Redis falhar, BLOQUEIA a requisição (retorna 503)
 * Use para rotas sensíveis: login, reset-password, checkout
 */
export async function rateLimitByIPStrict(
  request: NextRequest,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 5 }
): Promise<NextResponse | null> {
  const TRUSTED_PROXY_ENABLED = process.env.TRUST_PROXY === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  let ip: string | null = null;

  if (TRUSTED_PROXY_ENABLED) {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    ip = forwarded ? forwarded.split(',')[0].trim() : realIp;
  }

  // Se nao conseguir identificar IP, usar bucket global
  // Em producao: limite mais restritivo (metade) para prevenir abuso
  // Em desenvolvimento: manter limite normal para facilitar testes
  const key = ip ? `ip:${ip}:${action}` : `global:${action}`;
  const effectiveConfig = ip || !isProduction
    ? config
    : { ...config, maxRequests: Math.ceil(config.maxRequests / 2) };

  const result = await checkRateLimitStrict(key, effectiveConfig);

  // Se Redis indisponível, retornar 503 (fail-close)
  if (result.redisUnavailable) {
    return NextResponse.json(
      { message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' },
      { status: 503, headers: { 'Retry-After': '60' } }
    );
  }

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    return NextResponse.json(
      { message: 'Muitas requisições. Tente novamente mais tarde.', retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Enforce rate limit (throws ApiError se excedido)
 * Compativel com withApiHandler
 */
export async function enforceRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<void> {
  const result = await checkRateLimit(key, { windowMs, maxRequests: limit });

  if (!result.allowed) {
    throw new ApiError({
      code: 'rate_limit_exceeded',
      message: 'Limite de requisicoes excedido. Tente novamente em instantes.',
      status: 429,
      details: { key, limit, windowMs, resetTime: result.resetTime },
    });
  }
}

/**
 * Enforce rate limit STRICT para rotas sensíveis (throws ApiError se excedido ou Redis indisponível)
 * FAIL-CLOSE: Se Redis falhar, BLOQUEIA a requisição
 * Use para: login, reset-password, checkout, e outras operações sensíveis
 */
export async function enforceRateLimitStrict({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<void> {
  const result = await checkRateLimitStrict(key, { windowMs, maxRequests: limit });

  if (result.redisUnavailable) {
    throw new ApiError({
      code: 'service_unavailable',
      message: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
      status: 503,
      details: { reason: 'rate_limit_backend_unavailable' },
    });
  }

  if (!result.allowed) {
    throw new ApiError({
      code: 'rate_limit_exceeded',
      message: 'Limite de requisicoes excedido. Tente novamente em instantes.',
      status: 429,
      details: { key, limit, windowMs, resetTime: result.resetTime },
    });
  }
}

/**
 * Enforce rate limit by IP (throws ApiError se excedido)
 * Compativel com withApiHandler - extrai IP da request e aplica rate limit
 */
export async function enforceRateLimitByIP(
  request: NextRequest,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 5 }
): Promise<void> {
  const TRUSTED_PROXY_ENABLED = process.env.TRUST_PROXY === 'true';
  let ip: string | null = null;

  if (TRUSTED_PROXY_ENABLED) {
    // Apenas confiar em headers de proxy se explicitamente habilitado
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    ip = forwarded ? forwarded.split(',')[0].trim() : realIp;
  }
  // NOTA: NÃO usar x-real-ip se TRUST_PROXY não estiver habilitado (evita spoofing)

  // Se nao conseguir identificar IP, usar bucket global mais restritivo
  const key = ip ? `ip:${ip}:${action}` : `global:${action}`;
  const effectiveConfig = ip ? config : { ...config, maxRequests: Math.ceil(config.maxRequests / 2) };

  await enforceRateLimit({
    key,
    limit: effectiveConfig.maxRequests,
    windowMs: effectiveConfig.windowMs,
  });
}

/**
 * Enforce rate limit by IP - STRICT (fail-close)
 * Se Redis falhar, BLOQUEIA a requisição (throws ApiError 503)
 * Use para rotas sensíveis: login, reset-password, checkout
 */
export async function enforceRateLimitByIPStrict(
  request: NextRequest,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 5 }
): Promise<void> {
  const TRUSTED_PROXY_ENABLED = process.env.TRUST_PROXY === 'true';
  let ip: string | null = null;

  if (TRUSTED_PROXY_ENABLED) {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    ip = forwarded ? forwarded.split(',')[0].trim() : realIp;
  }

  const key = ip ? `ip:${ip}:${action}` : `global:${action}`;
  const effectiveConfig = ip ? config : { ...config, maxRequests: Math.ceil(config.maxRequests / 2) };

  await enforceRateLimitStrict({
    key,
    limit: effectiveConfig.maxRequests,
    windowMs: effectiveConfig.windowMs,
  });
}

// ============================================================================
// CONFIGURACOES PRE-DEFINIDAS
// ============================================================================

export const RATE_LIMITS = {
  // Operacoes financeiras - muito restritivo
  FINANCE: { windowMs: 60000, maxRequests: 5 },  // 5 req/min

  // Operacoes de usuario - moderado
  USER_MANAGEMENT: { windowMs: 60000, maxRequests: 10 },  // 10 req/min

  // Login attempts - muito restritivo
  LOGIN: { windowMs: 300000, maxRequests: 5 },  // 5 req/5min

  // Password reset - muito restritivo
  PASSWORD_RESET: { windowMs: 600000, maxRequests: 3 },  // 3 req/10min

  // Leitura de dados - mais permissivo
  READ: { windowMs: 60000, maxRequests: 30 },  // 30 req/min

  // Escrita geral - moderado
  WRITE: { windowMs: 60000, maxRequests: 15 },  // 15 req/min

  // Checkout - moderado (importante nao bloquear vendas)
  CHECKOUT: { windowMs: 60000, maxRequests: 10 },  // 10 req/min

  // Cotacoes - mais permissivo (usuarios fazem varias)
  QUOTES: { windowMs: 60000, maxRequests: 20 },  // 20 req/min

  // API publica - restritivo
  PUBLIC_API: { windowMs: 60000, maxRequests: 10 },  // 10 req/min
} as const;

