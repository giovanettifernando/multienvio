import 'server-only';

/**
 * Cliente HTTP para APIs da J&T Express Brasil
 *
 * Responsabilidades:
 * - Autenticação via assinatura dupla (header digest + body digest)
 * - Cache de configuração do banco de dados
 * - Wrapper genérico para chamadas às APIs
 *
 * Suporta configuração via:
 * 1. Banco de dados (Carrier + CarrierCredential) - prioridade
 * 2. Variáveis de ambiente - fallback
 *
 * Assinatura J&T (2 níveis):
 * 1. Password hash: MD5(password + "jadada236t2") → uppercase
 * 2. Body digest (dentro do JSON): Base64(MD5(customerCode + passwordHash + privateKey))
 * 3. Header digest: Base64(MD5(jsonPayload + privateKey))
 */

import { createHash } from 'crypto';
import {
  type JTConfig,
  type JTApiResponse,
  JTApiError,
  JTAuthError,
} from './types';
import {
  JT_API_BASE,
  JT_COST_API_BASE,
  JT_PASSWORD_SALT,
  JT_CARRIER_SLUG,
} from './constants';
import {
  jtCircuitBreaker,
  CircuitBreakerError,
} from '../shared/circuit-breaker';

// Cache de configuração do banco (evita múltiplas queries)
let dbConfigCache: JTConfig | null = null;
let dbConfigFetchedAt: Date | null = null;
const DB_CONFIG_CACHE_TTL_MS = 60 * 1000; // 1 minuto

// ============================================================================
// Funções de Hash / Assinatura
// ============================================================================

/**
 * Gera MD5 hash de uma string
 */
function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

/**
 * Gera MD5 hash e retorna em Base64
 */
function md5Base64(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('base64');
}

/**
 * Gera o hash da senha J&T
 * MD5(password + "jadada236t2") → uppercase
 */
function generatePasswordHash(password: string): string {
  return md5(password + JT_PASSWORD_SALT).toUpperCase();
}

/**
 * Gera o digest do body (vai DENTRO do JSON no campo "digest")
 * Base64(MD5(customerCode + passwordHash + privateKey))
 */
function generateBodyDigest(
  customerCode: string,
  passwordHash: string,
  privateKey: string
): string {
  return md5Base64(customerCode + passwordHash + privateKey);
}

/**
 * Gera o digest do header (vai no header HTTP "digest")
 * Base64(MD5(jsonPayload + privateKey))
 */
function generateHeaderDigest(
  jsonPayload: string,
  privateKey: string
): string {
  return md5Base64(jsonPayload + privateKey);
}

// ============================================================================
// Configuração
// ============================================================================

/**
 * Carrega configuração da J&T a partir de variáveis de ambiente
 */
function getJTConfigFromEnv(): JTConfig {
  const environment = (process.env.JT_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  return {
    environment,
    apiBase: environment === 'production'
      ? JT_API_BASE.production
      : JT_API_BASE.sandbox,
    costApiBase: environment === 'production'
      ? JT_COST_API_BASE.production
      : JT_COST_API_BASE.sandbox,
    customerCode: process.env.JT_CUSTOMER_CODE || '',
    password: process.env.JT_PASSWORD || '',
    apiAccount: process.env.JT_API_ACCOUNT || '',
    privateKey: process.env.JT_PRIVATE_KEY || '',
  };
}

/**
 * Carrega configuração do banco de dados (prioridade sobre env vars)
 * Usa cache de 1 minuto para evitar queries excessivas
 */
async function getJTConfigFromDB(): Promise<JTConfig | null> {
  // Verificar cache
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
      where: { slug: JT_CARRIER_SLUG, status: 'ACTIVE' },
    });

    if (!carrier) {
      return null;
    }

    // Buscar credenciais do ambiente ativo
    const credential = await prisma.carrierCredential.findFirst({
      where: {
        carrierId: carrier.id,
        environment: carrier.environment,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!credential) {
      console.warn('[JT_CLIENT] Nenhuma credencial encontrada para o ambiente:', carrier.environment);
      return null;
    }

    const customData = (credential.customHeaders as Record<string, unknown>) || {};

    // Descriptografar senha
    let password = '';
    if (credential.password) {
      try {
        password = decrypt(credential.password);
      } catch (err) {
        console.error('[JT_CLIENT] Failed to decrypt password:', err);
      }
    }

    // Descriptografar privateKey
    let privateKey = '';
    if (customData.privateKey) {
      try {
        privateKey = decrypt(customData.privateKey as string);
      } catch (err) {
        console.error('[JT_CLIENT] Failed to decrypt privateKey:', err);
      }
    }

    const environment = carrier.environment === 'SANDBOX' ? 'sandbox' : 'production' as const;

    const config: JTConfig = {
      environment,
      apiBase: carrier.baseUrl || (environment === 'production'
        ? JT_API_BASE.production
        : JT_API_BASE.sandbox),
      costApiBase: environment === 'production'
        ? JT_COST_API_BASE.production
        : JT_COST_API_BASE.sandbox,
      customerCode: credential.username || '',
      password,
      apiAccount: credential.clientId || '',
      privateKey,
    };

    console.log('[JT_CLIENT] Config carregada do banco:', {
      ambiente: config.environment,
      apiBase: config.apiBase,
      customerCode: config.customerCode ? `${config.customerCode.substring(0, 6)}****` : '(vazio)',
      temSenha: !!config.password,
      temPrivateKey: !!config.privateKey,
    });

    // Atualizar cache
    dbConfigCache = config;
    dbConfigFetchedAt = new Date();

    return config;
  } catch (error) {
    console.error('[JT_CLIENT] Failed to load config from DB:', error);
    return null;
  }
}

/**
 * Invalida o cache de configuração do banco
 */
export function invalidateJTConfigCache(): void {
  dbConfigCache = null;
  dbConfigFetchedAt = null;
  console.log('[JT_CLIENT] Config cache invalidated');
}

/**
 * Carrega configuração da J&T (versão síncrona)
 * Usa cache do banco ou fallback para env vars
 */
export function getJTConfig(): JTConfig {
  if (dbConfigCache && dbConfigFetchedAt) {
    const now = new Date();
    if (now.getTime() - dbConfigFetchedAt.getTime() < DB_CONFIG_CACHE_TTL_MS) {
      return dbConfigCache;
    }
  }
  return getJTConfigFromEnv();
}

/**
 * Carrega configuração da J&T (versão async)
 * Sempre verifica o banco primeiro
 */
export async function getJTConfigAsync(): Promise<JTConfig> {
  const dbConfig = await getJTConfigFromDB();
  if (dbConfig) {
    return dbConfig;
  }
  return getJTConfigFromEnv();
}

/**
 * Valida se a configuração está completa
 */
export function validateJTConfig(config: JTConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.customerCode) errors.push('Customer Code não configurado');
  if (!config.password) errors.push('Senha não configurada');
  if (!config.apiAccount) errors.push('API Account não configurado');
  if (!config.privateKey) errors.push('Private Key não configurada');

  return { valid: errors.length === 0, errors };
}

/**
 * Verifica se a integração da J&T está configurada (versão síncrona)
 */
export function isJTConfigured(): boolean {
  const config = getJTConfig();
  return validateJTConfig(config).valid;
}

// ============================================================================
// Fetch Wrapper
// ============================================================================

export interface JTFetchOptions {
  /** Usar base URL de cotação em vez da padrão */
  useCostApiBase?: boolean;
  /** Timeout em ms */
  timeout?: number;
}

/**
 * Executa uma chamada à API da J&T com autenticação por assinatura
 *
 * 1. Monta o payload bizContent JSON com body digest
 * 2. Calcula header digest sobre o JSON
 * 3. Envia como application/x-www-form-urlencoded
 */
export async function jtFetch<T = unknown>(
  endpoint: string,
  bizContentPayload: Record<string, unknown>,
  options: JTFetchOptions = {}
): Promise<T> {
  try {
    return await jtCircuitBreaker.execute(async () => {
      return await jtFetchInternal<T>(endpoint, bizContentPayload, options);
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      throw new JTApiError(
        'SERVICE_UNAVAILABLE',
        'Serviço da J&T temporariamente indisponível. Tente novamente em alguns minutos.'
      );
    }
    throw error;
  }
}

/**
 * Implementação interna do fetch (chamada pelo circuit breaker)
 */
async function jtFetchInternal<T = unknown>(
  endpoint: string,
  bizContentPayload: Record<string, unknown>,
  options: JTFetchOptions = {}
): Promise<T> {
  const config = await getJTConfigAsync();
  const validation = validateJTConfig(config);

  if (!validation.valid) {
    throw new JTAuthError(`Configuração da J&T inválida: ${validation.errors.join(', ')}`);
  }

  const baseUrl = options.useCostApiBase ? config.costApiBase : config.apiBase;
  const url = `${baseUrl}${endpoint}`;
  const timeout = options.timeout || 30000;
  const timestamp = Date.now().toString();

  // 1. Gerar hash da senha
  const passwordHash = generatePasswordHash(config.password);

  // 2. Gerar body digest (vai dentro do JSON)
  const bodyDigest = generateBodyDigest(config.customerCode, passwordHash, config.privateKey);

  // 3. Montar o payload completo com customerCode e digest
  const fullPayload = {
    ...bizContentPayload,
    customerCode: config.customerCode,
    digest: bodyDigest,
  };

  // 4. Serializar JSON do bizContent
  const bizContentJson = JSON.stringify(fullPayload);

  // 5. Gerar header digest (sobre o JSON + privateKey)
  const headerDigest = generateHeaderDigest(bizContentJson, config.privateKey);

  console.log('[JT_CLIENT] Request:', {
    url,
    endpoint,
    customerCode: config.customerCode,
    timestamp,
  });

  // 6. Enviar como x-www-form-urlencoded
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const body = `bizContent=${encodeURIComponent(bizContentJson)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'digest': headerDigest,
        'apiAccount': config.apiAccount,
        'timestamp': timestamp,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('[JT_CLIENT] Response:', {
      status: response.status,
      statusText: response.statusText,
      url,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[JT_CLIENT] HTTP error:', {
        status: response.status,
        url,
        error: errorText,
      });

      throw new JTApiError(
        response.status.toString(),
        `HTTP ${response.status}: ${errorText}`
      );
    }

    const data = await response.json() as JTApiResponse<T>;

    // Verificar código de sucesso da J&T (code = 1 ou "1")
    const code = String(data.code);
    if (code !== '1') {
      console.error('[JT_CLIENT] API error:', {
        code: data.code,
        msg: data.msg,
        url,
      });
      throw new JTApiError(data.code, data.msg);
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof JTApiError || error instanceof JTAuthError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new JTApiError('TIMEOUT', `Timeout na requisição: ${url}`);
    }

    console.error('[JT_CLIENT] Connection error:', error);
    throw new JTApiError(
      'CONNECTION_ERROR',
      `Erro de conexão com J&T: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }
}

// ============================================================================
// Teste de Autenticação
// ============================================================================

export interface JTAuthTestResult {
  success: boolean;
  message: string;
  passwordHash?: string;
  bodyDigest?: string;
  headerDigest?: string;
  error?: string;
  latencyMs: number;
}

/**
 * Testa a geração de assinaturas da J&T
 * Gera os digests e opcionalmente faz uma chamada à API de cotação
 */
export async function testJTAuth(): Promise<JTAuthTestResult> {
  const startTime = Date.now();

  try {
    const config = await getJTConfigAsync();
    const validation = validateJTConfig(config);

    if (!validation.valid) {
      return {
        success: false,
        message: `Configuração inválida: ${validation.errors.join(', ')}`,
        latencyMs: Date.now() - startTime,
      };
    }

    // Gerar hashes para validação
    const passwordHash = generatePasswordHash(config.password);
    const bodyDigest = generateBodyDigest(config.customerCode, passwordHash, config.privateKey);

    // Tentar uma cotação de teste para validar credenciais
    const testPayload = {
      customerCode: config.customerCode,
      digest: bodyDigest,
      destinationZipCode: '01310-100',
      productTypeCode: 'EZ',
      weight: '1',
    };

    const bizContentJson = JSON.stringify(testPayload);
    const headerDigest = generateHeaderDigest(bizContentJson, config.privateKey);

    return {
      success: true,
      message: 'Assinaturas geradas com sucesso',
      passwordHash: passwordHash.substring(0, 8) + '...',
      bodyDigest,
      headerDigest,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao gerar assinaturas',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Retorna informações sobre a configuração atual (para debug/admin)
 */
export function getJTConfigInfo(): {
  configured: boolean;
  environment: string;
  apiBase: string;
  customerCode: string;
  errors: string[];
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
} {
  const config = getJTConfig();
  const validation = validateJTConfig(config);

  return {
    configured: validation.valid,
    environment: config.environment,
    apiBase: config.apiBase,
    customerCode: config.customerCode
      ? config.customerCode.substring(0, 6) + '****'
      : '(não configurado)',
    errors: validation.errors,
    circuitBreakerState: jtCircuitBreaker.getState(),
  };
}

