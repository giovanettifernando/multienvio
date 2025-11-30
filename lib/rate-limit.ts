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
 * SECURITY: Lista de proxies confiáveis
 * Apenas aceitar X-Forwarded-For de proxies conhecidos
 * Configure TRUST_PROXY=true se você estiver atrás de um proxy reverso confiável
 */
const TRUSTED_PROXY_ENABLED = process.env.TRUST_PROXY === 'true';

/**
 * Rate limit baseado em IP
 * Usar para operações públicas ou como fallback
 *
 * SECURITY: Headers X-Forwarded-For podem ser spoofados por clientes maliciosos.
 * Só confie nesses headers se você estiver atrás de um proxy reverso confiável
 * (Nginx, Cloudflare, AWS ALB, etc.) que limpa esses headers.
 *
 * Configure TRUST_PROXY=true apenas se você estiver atrás de um proxy confiável.
 */
export function rateLimitByIP(
  request: NextRequest,
  action: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 5 }
): NextResponse | null {
  let ip: string | null = null;

  // SECURITY: Só confiar em X-Forwarded-For se proxy confiável estiver habilitado
  if (TRUSTED_PROXY_ENABLED) {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    ip = forwarded ? forwarded.split(',')[0].trim() : (realIp || null);
  }

  // Fallback: usar IP direto da conexão (não disponível em todos os ambientes)
  if (!ip) {
    ip = request.headers.get('x-real-ip') || null;
  }

  // 🔒 SECURITY: Se não conseguir identificar IP, aplicar rate limit global
  if (!ip) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[RATE_LIMIT] Cannot identify IP for action '${action}', using global bucket`);
      // Em produção, usar bucket global mais restritivo
      return checkRateLimit(`global:${action}`, { ...config, maxRequests: Math.ceil(config.maxRequests / 2) });
    }
    // Em desenvolvimento, permitir sem rate limit
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
