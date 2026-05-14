// platform/integrations/total-express/client.ts
import 'server-only';

import { type TEConfig, TEApiError, TEAuthError, TEAuthTestResult } from './types';
import {
  TE_API_BASE,
  TE_SOAP_BASE,
  TE_ENDPOINTS,
  TE_SOAP_NAMESPACE,
  TE_SOAP_ACTION_BASE,
  TE_CARRIER_SLUG,
} from './constants';
import {
  totalExpressCircuitBreaker,
  CircuitBreakerError,
} from '../shared/circuit-breaker';

// Cache de configuração do banco
let dbConfigCache: TEConfig | null = null;
let dbConfigFetchedAt: Date | null = null;
const DB_CONFIG_CACHE_TTL_MS = 60 * 1000;

// ============================================================================
// Config loading
// ============================================================================

function getTEConfigFromEnv(): TEConfig {
  return {
    environment: (process.env.TE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    apiBase: TE_API_BASE,
    soapBase: TE_SOAP_BASE,
    username: process.env.TE_USERNAME || '',
    password: process.env.TE_PASSWORD || '',
    remetenteId: process.env.TE_REMETENTE_ID || '',
    cnpj: process.env.TE_CNPJ || '',
  };
}

async function getTEConfigFromDB(): Promise<TEConfig | null> {
  if (dbConfigCache && dbConfigFetchedAt) {
    if (Date.now() - dbConfigFetchedAt.getTime() < DB_CONFIG_CACHE_TTL_MS) {
      return dbConfigCache;
    }
  }

  try {
    const { prisma } = await import('@/platform/db/db');
    const { decrypt } = await import('@/platform/integrations/shared/encryption.service');

    const carrier = await prisma.carrier.findFirst({
      where: { slug: TE_CARRIER_SLUG, status: 'ACTIVE' },
    });

    if (!carrier) return null;

    const credential = await prisma.carrierCredential.findFirst({
      where: { carrierId: carrier.id, environment: carrier.environment, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!credential) return null;

    const customData = (credential.customHeaders as Record<string, unknown>) || {};

    let password = '';
    if (credential.password) {
      try { password = decrypt(credential.password); } catch { /* ignore */ }
    }

    let remetenteId = '';
    if (customData.remetenteId) {
      try { remetenteId = decrypt(customData.remetenteId as string); } catch { /* ignore */ }
    }

    let cnpj = '';
    if (customData.cnpj) {
      try { cnpj = decrypt(customData.cnpj as string); } catch { /* ignore */ }
    }

    const config: TEConfig = {
      environment: carrier.environment === 'SANDBOX' ? 'sandbox' : 'production',
      apiBase: TE_API_BASE,
      soapBase: TE_SOAP_BASE,
      username: credential.username || '',
      password,
      remetenteId,
      cnpj,
    };

    dbConfigCache = config;
    dbConfigFetchedAt = new Date();
    return config;
  } catch (error) {
    console.error('[TE_CLIENT] Failed to load config from DB:', error);
    return null;
  }
}

export function invalidateTEConfigCache(): void {
  dbConfigCache = null;
  dbConfigFetchedAt = null;
}

export async function getTEConfigAsync(): Promise<TEConfig> {
  return (await getTEConfigFromDB()) ?? getTEConfigFromEnv();
}

export function validateTEConfig(config: TEConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.username) errors.push('Usuário não configurado');
  if (!config.password) errors.push('Senha não configurada');
  if (!config.remetenteId) errors.push('Remetente ID não configurado');
  if (!config.cnpj) errors.push('CNPJ não configurado');
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Basic Auth helper
// ============================================================================

function buildBasicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
}

// ============================================================================
// REST fetch wrapper
// ============================================================================

export async function teFetch<T = unknown>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    query?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<T> {
  try {
    return await totalExpressCircuitBreaker.execute(async () => {
      return await teFetchInternal<T>(endpoint, options);
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      throw new TEApiError(
        'SERVICE_UNAVAILABLE',
        'Total Express temporariamente indisponível. Tente novamente em alguns minutos.'
      );
    }
    throw error;
  }
}

async function teFetchInternal<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    query?: Record<string, string>;
    timeout?: number;
  }
): Promise<T> {
  const config = await getTEConfigAsync();
  const validation = validateTEConfig(config);
  if (!validation.valid) {
    throw new TEAuthError(`Configuração inválida: ${validation.errors.join(', ')}`);
  }

  const timeout = options.timeout || 30000;
  let url = `${config.apiBase}${endpoint}`;
  if (options.query) {
    const params = new URLSearchParams(options.query);
    url += `?${params.toString()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': buildBasicAuth(config.username, config.password),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new TEApiError(response.status, `HTTP ${response.status}: ${errorText}`);
    }

    return await response.json() as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof TEApiError || error instanceof TEAuthError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TEApiError('TIMEOUT', `Timeout na requisição: ${url}`);
    }
    throw new TEApiError('CONNECTION_ERROR', `Erro de conexão: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// SOAP call builder
// ============================================================================

export interface TESoapParams {
  Remetente_ID: string;
  CEP_Origem: string;
  CEP_Destino: string;
  Tipo_Servico: string;
  Peso: number;
  Comp: number;
  Larg: number;
  Alt: number;
  Valor_Coleta?: number;
}

export interface TESoapResult {
  Prazo: number;
  ValorServico: number;
  Retorno: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSoapEnvelope(params: TESoapParams): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns1="${TE_SOAP_NAMESPACE}">
  <SOAP-ENV:Body>
    <ns1:CalcFrete>
      <Remetente_ID>${escapeXml(params.Remetente_ID)}</Remetente_ID>
      <CEP_Origem>${escapeXml(params.CEP_Origem)}</CEP_Origem>
      <CEP_Destino>${escapeXml(params.CEP_Destino)}</CEP_Destino>
      <Tipo_Servico>${escapeXml(params.Tipo_Servico)}</Tipo_Servico>
      <Peso>${params.Peso}</Peso>
      <Comp>${params.Comp}</Comp>
      <Larg>${params.Larg}</Larg>
      <Alt>${params.Alt}</Alt>
      ${params.Valor_Coleta != null ? `<Valor_Coleta>${params.Valor_Coleta}</Valor_Coleta>` : ''}
    </ns1:CalcFrete>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

function parseSoapResponse(xml: string): TESoapResult {
  const extractTag = (tag: string): string => {
    const match = new RegExp(`<(?:[^:>]+:)?${tag}>([^<]*)<`, 'i').exec(xml);
    return match?.[1]?.trim() ?? '';
  };

  const prazo = parseInt(extractTag('Prazo') || '0', 10);
  const valorStr = extractTag('ValorServico') || '0';
  const valorServico = parseFloat(valorStr.replace(',', '.'));
  const retorno = extractTag('Retorno') || extractTag('return') || '0';

  return { Prazo: prazo, ValorServico: valorServico, Retorno: retorno };
}

export async function teSoapCalcFrete(params: TESoapParams): Promise<TESoapResult> {
  const config = await getTEConfigAsync();
  const validation = validateTEConfig(config);
  if (!validation.valid) {
    throw new TEAuthError(`Configuração inválida: ${validation.errors.join(', ')}`);
  }

  const url = `${config.soapBase}${TE_ENDPOINTS.calcFrete}`;
  const envelope = buildSoapEnvelope(params);
  const timeout = 30000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': TE_SOAP_ACTION_BASE,
        'Authorization': buildBasicAuth(config.username, config.password),
      },
      body: envelope,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();

    if (!response.ok) {
      throw new TEApiError(response.status, `SOAP HTTP ${response.status}: ${text.substring(0, 500)}`);
    }

    const result = parseSoapResponse(text);

    if (result.Retorno !== '0' && result.Retorno !== '' && result.Prazo === 0 && result.ValorServico === 0) {
      throw new TEApiError('SOAP_ERROR', `SOAP Retorno=${result.Retorno}. XML: ${text.substring(0, 300)}`);
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof TEApiError || error instanceof TEAuthError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TEApiError('TIMEOUT', `Timeout no SOAP CalcFrete (${params.Tipo_Servico})`);
    }
    throw new TEApiError('SOAP_CONNECTION_ERROR', error instanceof Error ? error.message : String(error));
  }
}

// ============================================================================
// Auth test
// ============================================================================

export async function testTEAuth(): Promise<TEAuthTestResult> {
  const startTime = Date.now();
  try {
    const config = await getTEConfigAsync();
    const validation = validateTEConfig(config);

    if (!validation.valid) {
      return {
        success: false,
        message: `Configuração inválida: ${validation.errors.join(', ')}`,
        latencyMs: Date.now() - startTime,
      };
    }

    // Try a SOAP call with test data to verify credentials
    await teSoapCalcFrete({
      Remetente_ID: config.remetenteId,
      CEP_Origem: '01310100',
      CEP_Destino: '20040020',
      Tipo_Servico: 'EXP',
      Peso: 1000,
      Comp: 20,
      Larg: 15,
      Alt: 10,
    });

    return {
      success: true,
      message: 'Autenticação e cotação SOAP bem-sucedidas',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha na autenticação',
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime,
    };
  }
}
