import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;  // Janela de tempo em ms
  maxRequests: number;  // Máximo de requisições na janela
}

interface RequestLog {
  count: number;
  resetTime: number;
}

// Armazena logs de requisições por chave (userId:action ou ip:action)
const requestLogs = new Map<string, RequestLog>();

// Limpeza periódica de logs expirados (a cada 5 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [key, log] of requestLogs.entries()) {
    if (now > log.resetTime) {
      requestLogs.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Verifica rate limit para uma requisição
 *
 * @param key - Chave única para o rate limit (ex: userId, IP)
 * @param config - Configuração do rate limit
 * @returns null se permitido, NextResponse com erro 429 se bloqueado
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): NextResponse | null {
  const now = Date.now();
  const log = requestLogs.get(key);

  // Se não há log ou o tempo resetou, criar novo
  if (!log || now > log.resetTime) {
    requestLogs.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return null;
  }

  // Se atingiu o limite, retornar erro
  if (log.count >= config.maxRequests) {
    const retryAfter = Math.ceil((log.resetTime - now) / 1000);
    return NextResponse.json(
      {
        message: 'Muitas requisições. Tente novamente mais tarde.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': log.resetTime.toString(),
        },
      }
    );
  }

  // Incrementar contador
  log.count += 1;
  requestLogs.set(key, log);

  return null;
}

/**
 * Rate limit baseado em sessão de usuário
 * Usar para operações que requerem autenticação
 */
export function rateLimitByUser(
  userId: string,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }
): NextResponse | null {
  return checkRateLimit(`user:${userId}:${action}`, config);
}

/**
 * Rate limit baseado em IP
 * Usar para operações públicas ou como fallback
 */
export function rateLimitByIP(
  request: NextRequest,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 5 }
): NextResponse | null {
  // Extrair IP do request
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : (request.headers.get('x-real-ip') || null);

  // 🔒 SECURITY: Se não conseguir identificar IP, não aplicar rate limiting
  // para evitar bloquear todos os usuários no mesmo bucket 'unknown'
  if (!ip) {
    console.warn(`[RATE_LIMIT] Cannot identify IP for action '${action}', skipping rate limit (security risk in production)`);
    return null;
  }

  return checkRateLimit(`ip:${ip}:${action}`, config);
}

/**
 * Configurações pré-definidas para diferentes tipos de operações
 */
export const RATE_LIMITS = {
  // Operações financeiras - muito restritivo
  FINANCE: { windowMs: 60000, maxRequests: 5 },  // 5 req/min

  // Operações de usuário - moderado
  USER_MANAGEMENT: { windowMs: 60000, maxRequests: 10 },  // 10 req/min

  // Login attempts - muito restritivo
  LOGIN: { windowMs: 300000, maxRequests: 5 },  // 5 req/5min

  // Password reset - muito restritivo
  PASSWORD_RESET: { windowMs: 600000, maxRequests: 3 },  // 3 req/10min

  // Leitura de dados - mais permissivo
  READ: { windowMs: 60000, maxRequests: 30 },  // 30 req/min

  // Escrita geral - moderado
  WRITE: { windowMs: 60000, maxRequests: 15 },  // 15 req/min
} as const;
