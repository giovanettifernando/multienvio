import 'server-only';

/**
 * Cliente HTTP para APIs da Loggi
 *
 * Responsabilidades:
 * - Autenticação OAuth2 com cache de token
 * - Cache de configuração do banco de dados
 * - Wrapper genérico para chamadas às APIs
 *
 * Suporta configuração via:
 * 1. Banco de dados (Carrier + CarrierCredential) - prioridade
 * 2. Variáveis de ambiente - fallback
 *
 * Autenticação Loggi:
 * POST /v2/oauth2/token com { client_id, client_secret }
 * Retorna { idToken, expiresIn } → Bearer token no header Authorization
 */

import type {
  LoggiConfig,
  LoggiTokenResponse,
  LoggiAuthTestResult,
  LoggiErrorResponse,
} from './types';
import { LoggiApiError, LoggiAuthError } from './types';
import { LOGGI_API_BASE, LOGGI_ENDPOINTS, LOGGI_CARRIER_SLUG } from './constants';
import {
  loggiCircuitBreaker,
  CircuitBreakerError,
} from '../shared/circuit-breaker';

// ============================================================================
// Cache
// ============================================================================

// Cache de configuração do banco (evita múltiplas queries)
let dbConfigCache: LoggiConfig | null = null;
let dbConfigFetchedAt: Date | null = null;
const DB_CONFIG_CACHE_TTL_MS = 60 * 1000; // 1 minuto

// Cache de token OAuth2
let tokenCache: { token: string; expiresAt: Date } | null = null;

// ============================================================================
// Configuração
// ============================================================================

/**
 * Carrega configuração da Loggi a partir de variáveis de ambiente
 */
function getLoggiConfigFromEnv(): LoggiConfig {
  const environment = (process.env.LOGGI_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  return {
    environment,
    apiBase: environment === 'production'
      ? LOGGI_API_BASE.production
      : LOGGI_API_BASE.sandbox,
    clientId: process.env.LOGGI_CLIENT_ID || '',
    clientSecret: process.env.LOGGI_CLIENT_SECRET || '',
    companyId: process.env.LOGGI_COMPANY_ID || '',
  };
}

/**
 * Carrega configuração do banco de dados (prioridade sobre env vars)
 */
async function getLoggiConfigFromDB(): Promise<LoggiConfig | null> {
  if (dbConfigCache && dbConfigFetchedAt) {
    const now = new Date();
    if (now.getTime() - dbConfigFetchedAt.getTime() < DB_CONFIG_CACHE_TTL_MS) {
      return dbConfigCache;
    }
  }

  try {
    const { prisma } = await import('@/platform/db/db');
    const { decrypt } = await import('@/platform/integrations/shared/encryption.service');

    const carrier = await prisma.carrier.findFirst({
      where: { slug: LOGGI_CARRIER_SLUG, status: 'ACTIVE' },
    });

    if (!carrier) {
      return null;
    }

    const credential = await prisma.carrierCredential.findFirst({
      where: {
        carrierId: carrier.id,
        environment: carrier.environment,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!credential) {
      console.warn('[LOGGI_CLIENT] Nenhuma credencial encontrada para o ambiente:', carrier.environment);
      return null;
    }

    const customData = (credential.customHeaders as Record<string, unknown>) || {};

    // Descriptografar clientSecret
    let clientSecret = '';
    if (credential.password) {
      try {
        clientSecret = decrypt(credential.password);
      } catch (err) {
        console.error('[LOGGI_CLIENT] Failed to decrypt clientSecret:', err);
      }
    }

    // companyId armazenado em customHeaders
    const companyId = (customData.companyId as string) || '';

    const environment = carrier.environment === 'SANDBOX' ? 'sandbox' : 'production' as const;

    const config: LoggiConfig = {
      environment,
      apiBase: carrier.baseUrl || (environment === 'production'
        ? LOGGI_API_BASE.production
        : LOGGI_API_BASE.sandbox),
      clientId: credential.clientId || '',
      clientSecret,
      companyId,
    };

    console.log('[LOGGI_CLIENT] Config carregada do banco:', {
      ambiente: config.environment,
      apiBase: config.apiBase,
      clientId: config.clientId ? `${config.clientId.substring(0, 8)}...` : '(vazio)',
      temSecret: !!config.clientSecret,
      companyId: config.companyId || '(vazio)',
    });

    dbConfigCache = config;
    dbConfigFetchedAt = new Date();

    return config;
  } catch (error) {
    console.error('[LOGGI_CLIENT] Erro ao carregar config do banco:', error);
    return null;
  }
}

/**
 * Carrega configuração da Loggi (versão async)
 */
export async function getLoggiConfigAsync(): Promise<LoggiConfig> {
  const dbConfig = await getLoggiConfigFromDB();
  if (dbConfig) {
    return dbConfig;
  }
  return getLoggiConfigFromEnv();
}

/**
 * Valida se a configuração está completa
 */
export function validateLoggiConfig(config: LoggiConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.clientId) errors.push('client_id não configurado');
  if (!config.clientSecret) errors.push('client_secret não configurado');
  if (!config.companyId) errors.push('company_id não configurado');

  return { valid: errors.length === 0, errors };
}

/**
 * Verifica se a Loggi está configurada (versão async)
 */
export async function isLoggiConfigured(): Promise<boolean> {
  const config = await getLoggiConfigAsync();
  const validation = validateLoggiConfig(config);
  return validation.valid;
}

/**
 * Invalida o cache de configuração
 */
export function invalidateLoggiConfigCache(): void {
  dbConfigCache = null;
  dbConfigFetchedAt = null;
  tokenCache = null;
}

/**
 * Retorna informações da configuração (para admin)
 */
export async function getLoggiConfigInfo(): Promise<{
  configured: boolean;
  environment: string;
  apiBase: string;
  hasCredentials: boolean;
}> {
  const config = await getLoggiConfigAsync();
  const validation = validateLoggiConfig(config);

  return {
    configured: validation.valid,
    environment: config.environment,
    apiBase: config.apiBase,
    hasCredentials: !!config.clientId && !!config.clientSecret,
  };
}

// ============================================================================
// Token OAuth2
// ============================================================================

/**
 * Obtém token OAuth2 da Loggi (com cache)
 * Usa o SDK oficial @api/loggi-platform para autenticação
 */
async function getLoggiToken(config: LoggiConfig): Promise<string> {
  // Verificar cache (com margem de 30s)
  if (tokenCache) {
    const now = new Date();
    const margin = 30 * 1000;
    if (tokenCache.expiresAt.getTime() - margin > now.getTime()) {
      return tokenCache.token;
    }
  }

  console.log('[LOGGI_CLIENT] Requesting new token via SDK:', {
    apiBase: config.apiBase,
    clientId: config.clientId,
  });

  // Dynamic import para evitar problema do Turbopack com es5-ext (#)
  const loggiPlatform = (await import('@api/loggi-platform')).default;

  // Configurar server URL do SDK baseado no ambiente
  loggiPlatform.server(config.apiBase);

  try {
    const { data } = await loggiPlatform.authenticateV2({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    if (!data.idToken) {
      throw new LoggiAuthError('Token não retornado pela API');
    }

    // Cache do token
    const expiresInMs = (parseInt(data.expiresIn, 10) || 300) * 1000;
    tokenCache = {
      token: data.idToken,
      expiresAt: new Date(Date.now() + expiresInMs),
    };

    console.log('[LOGGI_CLIENT] Token obtido via SDK, expira em', data.expiresIn, 'segundos');

    return data.idToken;
  } catch (error) {
    // Mapear erros do SDK para LoggiAuthError
    if (error instanceof LoggiAuthError) throw error;

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new LoggiAuthError(`Loggi Auth Error: ${errorMsg}`);
  }
}

// ============================================================================
// Fetch Wrapper
// ============================================================================

export interface LoggiFetchOptions {
  /** Timeout em ms (default: 30000) */
  timeout?: number;
  /** HTTP method (default: POST) */
  method?: 'GET' | 'POST' | 'PATCH';
}

/**
 * Executa uma chamada à API da Loggi com autenticação OAuth2
 */
export async function loggiFetch<T = unknown>(
  endpoint: string,
  body?: Record<string, unknown> | null,
  options: LoggiFetchOptions = {}
): Promise<T> {
  try {
    return await loggiCircuitBreaker.execute(async () => {
      return await loggiFetchInternal<T>(endpoint, body, options);
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      throw new LoggiApiError(
        'SERVICE_UNAVAILABLE',
        'Serviço da Loggi temporariamente indisponível. Tente novamente em alguns minutos.'
      );
    }
    throw error;
  }
}

/**
 * Implementação interna do fetch
 */
async function loggiFetchInternal<T = unknown>(
  endpoint: string,
  body?: Record<string, unknown> | null,
  options: LoggiFetchOptions = {}
): Promise<T> {
  const config = await getLoggiConfigAsync();
  const validation = validateLoggiConfig(config);

  if (!validation.valid) {
    throw new LoggiAuthError(`Configuração da Loggi inválida: ${validation.errors.join(', ')}`);
  }

  // Substituir placeholders na URL
  const resolvedEndpoint = endpoint
    .replace('{companyId}', config.companyId);

  const url = `${config.apiBase}${resolvedEndpoint}`;
  const timeout = options.timeout || 30000;
  const method = options.method || 'POST';

  // Obter token
  const token = await getLoggiToken(config);

  console.log('[LOGGI_CLIENT] Request:', {
    url,
    method,
    companyId: config.companyId,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: controller.signal,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    clearTimeout(timeoutId);

    console.log('[LOGGI_CLIENT] Response:', {
      status: response.status,
      statusText: response.statusText,
      url,
    });

    if (!response.ok) {
      let errorData: LoggiErrorResponse | null = null;
      try {
        errorData = await response.json() as LoggiErrorResponse;
      } catch {
        // Ignore parse errors
      }

      const errorMsg = errorData?.message || `HTTP ${response.status}`;
      const errorCode = errorData?.code || response.status;

      console.error('[LOGGI_CLIENT] API error:', {
        code: errorCode,
        msg: errorMsg,
        url,
      });

      if (response.status === 401 || response.status === 403) {
        // Limpar token cache para forçar renovação
        tokenCache = null;
        throw new LoggiAuthError(errorMsg);
      }

      throw new LoggiApiError(errorCode, errorMsg);
    }

    const data = await response.json() as T;
    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof LoggiApiError || error instanceof LoggiAuthError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new LoggiApiError('TIMEOUT', `Timeout na requisição: ${url}`);
    }

    console.error('[LOGGI_CLIENT] Connection error:', error);
    throw new LoggiApiError(
      'CONNECTION_ERROR',
      `Erro de conexão com Loggi: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }
}

// ============================================================================
// Teste de Autenticação
// ============================================================================

/**
 * Testa a autenticação OAuth2 da Loggi
 */
export async function testLoggiAuth(): Promise<LoggiAuthTestResult> {
  const startTime = Date.now();

  try {
    const config = await getLoggiConfigAsync();
    const validation = validateLoggiConfig(config);

    if (!validation.valid) {
      return {
        success: false,
        message: `Configuração inválida: ${validation.errors.join(', ')}`,
        latencyMs: Date.now() - startTime,
      };
    }

    // Limpar cache para forçar nova autenticação
    tokenCache = null;

    const token = await getLoggiToken(config);

    // Capturar expiresAt antes de retornar (tokenCache pode ter sido preenchido por getLoggiToken)
    const cachedExpiry = tokenCache as { token: string; expiresAt: Date } | null;

    return {
      success: true,
      message: 'Autenticação OAuth2 realizada com sucesso',
      tokenPrefix: `${token.substring(0, 20)}...`,
      expiresIn: cachedExpiry?.expiresAt
        ? `${Math.round((cachedExpiry.expiresAt.getTime() - Date.now()) / 1000)}s`
        : undefined,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Reseta o circuit breaker da Loggi
 */
export function resetLoggiCircuitBreaker(): void {
  loggiCircuitBreaker.reset();
}
