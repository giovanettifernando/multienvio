/**
 * Cliente HTTP para APIs REST dos Correios (CWS)
 *
 * Responsabilidades:
 * - Autenticação via Token JWT
 * - Cache de token em memória com controle de expiração
 * - Wrapper genérico para chamadas às APIs
 *
 * Suporta configuração via:
 * 1. Banco de dados (Carrier + CarrierCredential) - prioridade
 * 2. Variáveis de ambiente - fallback
 *
 * Referência: https://www.correios.com.br/atendimento/developers
 */

import {
  type CorreiosConfig,
  type CorreiosTokenResponse,
  type TokenCache,
  CorreiosApiError,
  CorreiosAuthError,
} from './types';
import { CORREIOS_API_BASE, CORREIOS_ENDPOINTS } from './constants';

// Cache de configuração do banco (evita múltiplas queries)
let dbConfigCache: CorreiosConfig | null = null;
let dbConfigFetchedAt: Date | null = null;
const DB_CONFIG_CACHE_TTL_MS = 60 * 1000; // 1 minuto

// ============================================================================
// Configuração
// ============================================================================

/**
 * Carrega configuração dos Correios a partir de variáveis de ambiente
 */
function getCorreiosConfigFromEnv(): CorreiosConfig {
  const environment = (process.env.CORREIOS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  // Usar API_BASE do env ou default baseado no ambiente
  const apiBase = process.env.CORREIOS_API_BASE ||
    (environment === 'production'
      ? CORREIOS_API_BASE.production
      : CORREIOS_API_BASE.sandbox);

  const usuario = process.env.CORREIOS_USER || '';
  const senha = process.env.CORREIOS_PASSWORD || '';
  const cartaoPostagem = process.env.CORREIOS_CARTAO_POSTAGEM || '';
  const apiKey = process.env.CORREIOS_API_KEY || '';
  const contrato = process.env.CORREIOS_CONTRATO;
  const dr = process.env.CORREIOS_DR ? parseInt(process.env.CORREIOS_DR, 10) : undefined;

  return {
    environment,
    apiBase,
    usuario,
    senha,
    cartaoPostagem,
    apiKey,
    contrato,
    dr,
  };
}

/**
 * Carrega configuração do banco de dados (prioridade sobre env vars)
 * Usa cache de 1 minuto para evitar queries excessivas
 */
async function getCorreiosConfigFromDB(): Promise<CorreiosConfig | null> {
  // Verificar cache
  if (dbConfigCache && dbConfigFetchedAt) {
    const now = new Date();
    if (now.getTime() - dbConfigFetchedAt.getTime() < DB_CONFIG_CACHE_TTL_MS) {
      return dbConfigCache;
    }
  }

  try {
    // Import dinâmico para evitar dependência circular
    const { prisma } = await import('@/lib/db');
    const { decrypt } = await import('@/lib/integrations/shared/encryption.service');

    const carrier = await prisma.carrier.findFirst({
      where: { slug: 'correios', status: 'ACTIVE' },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!carrier || carrier.credentials.length === 0) {
      return null;
    }

    const credential = carrier.credentials[0];
    const customData = (credential.customHeaders as Record<string, unknown>) || {};

    // Descriptografar senha
    let senha = '';
    if (credential.password) {
      try {
        senha = decrypt(credential.password);
      } catch (err) {
        console.error('[CORREIOS_CLIENT] Failed to decrypt password:', err);
      }
    }

    // Descriptografar API Key se existir
    let apiKey = '';
    if (customData.apiKey) {
      try {
        apiKey = decrypt(customData.apiKey as string);
      } catch (err) {
        console.error('[CORREIOS_CLIENT] Failed to decrypt API Key:', err);
      }
    }

    const config: CorreiosConfig = {
      environment: carrier.environment === 'SANDBOX' ? 'sandbox' : 'production',
      apiBase: carrier.baseUrl || (carrier.environment === 'SANDBOX'
        ? CORREIOS_API_BASE.sandbox
        : CORREIOS_API_BASE.production),
      usuario: credential.username || '',
      senha,
      cartaoPostagem: credential.clientId || '',
      apiKey: apiKey || undefined,
      contrato: (customData.contrato as string) || undefined,
      dr: customData.dr ? parseInt(customData.dr as string, 10) : undefined,
    };

    // Atualizar cache
    dbConfigCache = config;
    dbConfigFetchedAt = new Date();

    return config;
  } catch (error) {
    console.error('[CORREIOS_CLIENT] Failed to load config from DB:', error);
    return null;
  }
}

/**
 * Invalida o cache de configuração do banco
 */
export function invalidateCorreiosConfigCache(): void {
  dbConfigCache = null;
  dbConfigFetchedAt = null;
  console.log('[CORREIOS_CLIENT] Config cache invalidated');
}

/**
 * Carrega configuração dos Correios
 * Prioridade: banco de dados > variáveis de ambiente
 *
 * NOTA: Esta função é síncrona para manter compatibilidade.
 * Usa o cache do banco ou fallback para env vars.
 */
export function getCorreiosConfig(): CorreiosConfig {
  // Se temos cache válido do banco, usar
  if (dbConfigCache && dbConfigFetchedAt) {
    const now = new Date();
    if (now.getTime() - dbConfigFetchedAt.getTime() < DB_CONFIG_CACHE_TTL_MS) {
      return dbConfigCache;
    }
  }

  // Fallback para env vars
  return getCorreiosConfigFromEnv();
}

/**
 * Carrega configuração dos Correios (versão async)
 * Sempre verifica o banco primeiro
 */
export async function getCorreiosConfigAsync(): Promise<CorreiosConfig> {
  const dbConfig = await getCorreiosConfigFromDB();
  if (dbConfig) {
    return dbConfig;
  }
  return getCorreiosConfigFromEnv();
}

/**
 * Valida se a configuração está completa
 * Suporta dois modos de autenticação:
 * 1. API Key (novo): apenas apiKey é necessário
 * 2. Legado: usuario + senha + cartaoPostagem
 */
export function validateCorreiosConfig(config: CorreiosConfig): { valid: boolean; errors: string[]; authMode: 'apiKey' | 'legacy' | 'invalid' } {
  const errors: string[] = [];

  // Se tem API Key, usa modo API Key
  if (config.apiKey && config.apiKey.length > 0) {
    return {
      valid: true,
      errors: [],
      authMode: 'apiKey',
    };
  }

  // Modo legado: precisa de usuario, senha e cartaoPostagem
  if (!config.usuario) {
    errors.push('CORREIOS_USER não configurado');
  }
  if (!config.senha) {
    errors.push('CORREIOS_PASSWORD não configurado');
  }
  if (!config.cartaoPostagem) {
    errors.push('CORREIOS_CARTAO_POSTAGEM não configurado');
  }

  return {
    valid: errors.length === 0,
    errors,
    authMode: errors.length === 0 ? 'legacy' : 'invalid',
  };
}

// ============================================================================
// Cache de Token
// ============================================================================

// Cache em memória (por instância do Node.js)
// Em produção, considerar cache distribuído (Redis)
let tokenCache: TokenCache | null = null;

// Margem de segurança para renovação do token (5 minutos antes de expirar)
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/**
 * Verifica se o token em cache ainda é válido
 */
function isTokenValid(): boolean {
  if (!tokenCache) {
    return false;
  }

  const now = new Date();
  const expiryWithMargin = new Date(tokenCache.expiraEm.getTime() - TOKEN_EXPIRY_MARGIN_MS);

  return now < expiryWithMargin;
}

/**
 * Limpa o cache de token (útil para forçar renovação)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  console.log('[CORREIOS_CLIENT] Token cache cleared');
}

// ============================================================================
// Autenticação
// ============================================================================

/**
 * Obtém um novo token de autenticação dos Correios
 *
 * Endpoint: POST /token/v1/autentica/cartaopostagem
 * Auth: Basic (usuario:senha)
 * Body: { "numero": "<cartaoPostagem>" }
 */
async function fetchCorreiosToken(config: CorreiosConfig): Promise<TokenCache> {
  const url = `${config.apiBase}${CORREIOS_ENDPOINTS.token}`;

  // Montar Basic Auth
  const credentials = Buffer.from(`${config.usuario}:${config.senha}`).toString('base64');

  console.log('[CORREIOS_CLIENT] Requesting new token...', {
    url,
    cartaoPostagem: config.cartaoPostagem.substring(0, 4) + '****',
    environment: config.environment,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        numero: config.cartaoPostagem,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');

      console.error('[CORREIOS_CLIENT] Token request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      if (response.status === 401 || response.status === 403) {
        throw new CorreiosAuthError(
          `Autenticação falhou: ${response.status} - ${errorText}`,
          response.status
        );
      }

      throw new CorreiosApiError(
        `Erro ao obter token: ${response.status} - ${errorText}`,
        response.status
      );
    }

    const data: CorreiosTokenResponse = await response.json();

    if (!data.token || !data.expiraEm) {
      throw new CorreiosApiError('Resposta de token inválida: token ou expiraEm ausente');
    }

    const tokenData: TokenCache = {
      token: data.token,
      expiraEm: new Date(data.expiraEm),
      fetchedAt: new Date(),
    };

    console.log('[CORREIOS_CLIENT] Token obtained successfully', {
      expiresAt: tokenData.expiraEm.toISOString(),
      ambiente: data.ambiente,
      hasCartaoPostagem: !!data.cartaoPostagem,
      servicosDisponiveis: data.cartaoPostagem?.servicos?.length || 0,
    });

    // Log dos serviços disponíveis no contrato (útil para debug)
    if (data.cartaoPostagem?.servicos) {
      console.log('[CORREIOS_CLIENT] Serviços disponíveis no contrato:', {
        servicos: data.cartaoPostagem.servicos.map(s => ({
          codigo: s.codigo,
          descricao: s.descricao,
        })),
      });
    }

    return tokenData;
  } catch (error) {
    if (error instanceof CorreiosApiError) {
      throw error;
    }

    console.error('[CORREIOS_CLIENT] Token fetch error:', error);
    throw new CorreiosApiError(
      `Erro de conexão ao obter token: ${error instanceof Error ? error.message : 'Unknown'}`,
      undefined,
      'CONNECTION_ERROR'
    );
  }
}

/**
 * Obtém token válido do cache ou renova se necessário
 * Suporta dois modos:
 * 1. API Key: retorna a API Key diretamente (não precisa de fetch)
 * 2. Legado: busca JWT token usando Basic Auth
 */
export async function getCorreiosToken(): Promise<string> {
  // Obter config (pode vir do cache ou env)
  const config = getCorreiosConfig();

  // Validar configuração
  const validation = validateCorreiosConfig(config);
  if (!validation.valid) {
    throw new CorreiosAuthError(
      `Configuração dos Correios inválida: ${validation.errors.join(', ')}`
    );
  }

  // Modo API Key: retornar diretamente sem fetch
  if (validation.authMode === 'apiKey' && config.apiKey) {
    console.log('[CORREIOS_CLIENT] Using API Key authentication');
    return config.apiKey;
  }

  // Modo legado: verificar cache e buscar token se necessário
  if (isTokenValid() && tokenCache) {
    console.log('[CORREIOS_CLIENT] Using cached token', {
      expiresAt: tokenCache.expiraEm.toISOString(),
    });
    return tokenCache.token;
  }

  // Buscar novo token JWT
  tokenCache = await fetchCorreiosToken(config);

  return tokenCache.token;
}

// ============================================================================
// Fetch Wrapper
// ============================================================================

export interface CorreiosFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  timeout?: number;
}

/**
 * Wrapper para chamadas às APIs dos Correios
 *
 * - Adiciona token Bearer automaticamente
 * - Trata erros de forma padronizada
 * - Suporta timeout
 */
export async function correiosFetch<T = unknown>(
  path: string,
  options: CorreiosFetchOptions = {}
): Promise<T> {
  const config = getCorreiosConfig();
  const url = `${config.apiBase}${path}`;
  const timeout = options.timeout || 30000; // 30 segundos default

  // Preparar headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  // Adicionar token de autenticação (se não for skipAuth)
  if (!options.skipAuth) {
    const token = await getCorreiosToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('[CORREIOS_CLIENT] Request:', {
    method: options.method || 'GET',
    url,
    hasBody: !!options.body,
  });

  try {
    // Criar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Log da resposta
    console.log('[CORREIOS_CLIENT] Response:', {
      status: response.status,
      statusText: response.statusText,
      url,
    });

    // Tratar erros HTTP
    if (!response.ok) {
      let errorDetails: unknown;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = await response.text().catch(() => null);
      }

      console.error('[CORREIOS_CLIENT] Request failed:', {
        status: response.status,
        url,
        errorDetails,
      });

      // Token expirado ou inválido - limpar cache e tentar novamente
      if (response.status === 401 && !options.skipAuth) {
        console.warn('[CORREIOS_CLIENT] Token expired, clearing cache...');
        clearTokenCache();

        // Tentar novamente uma vez com novo token
        return correiosFetch(path, { ...options, skipAuth: false });
      }

      throw new CorreiosApiError(
        `API Correios retornou erro: ${response.status}`,
        response.status,
        undefined,
        errorDetails
      );
    }

    // Parse da resposta
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return await response.json() as T;
    }

    // Para respostas não-JSON (ex: etiquetas PDF/ZPL)
    if (contentType.includes('application/pdf') || contentType.includes('application/zpl')) {
      const buffer = await response.arrayBuffer();
      return {
        content: Buffer.from(buffer),
        contentType,
      } as unknown as T;
    }

    // Fallback para text
    return await response.text() as unknown as T;
  } catch (error) {
    if (error instanceof CorreiosApiError) {
      throw error;
    }

    // Erro de timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CorreiosApiError(
        `Timeout na requisição: ${url}`,
        408,
        'TIMEOUT'
      );
    }

    // Erro de conexão
    console.error('[CORREIOS_CLIENT] Connection error:', error);
    throw new CorreiosApiError(
      `Erro de conexão com Correios: ${error instanceof Error ? error.message : 'Unknown'}`,
      undefined,
      'CONNECTION_ERROR'
    );
  }
}

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Converte string com vírgula (formato BR) para número
 * Ex: "17,93" -> 17.93
 */
export function parseCorreiosDecimal(value: string | undefined | null): number {
  if (!value) return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

/**
 * Verifica se a integração dos Correios está configurada
 */
export function isCorreiosConfigured(): boolean {
  const config = getCorreiosConfig();
  const validation = validateCorreiosConfig(config);
  return validation.valid;
}

/**
 * Retorna informações sobre a configuração atual (para debug/admin)
 */
export function getCorreiosConfigInfo(): {
  configured: boolean;
  environment: string;
  apiBase: string;
  cartaoPostagem: string;
  authMode: 'apiKey' | 'legacy' | 'invalid';
  errors: string[];
} {
  const config = getCorreiosConfig();
  const validation = validateCorreiosConfig(config);

  return {
    configured: validation.valid,
    environment: config.environment,
    apiBase: config.apiBase,
    cartaoPostagem: config.cartaoPostagem
      ? config.cartaoPostagem.substring(0, 4) + '****'
      : '(não configurado)',
    authMode: validation.authMode,
    errors: validation.errors,
  };
}
