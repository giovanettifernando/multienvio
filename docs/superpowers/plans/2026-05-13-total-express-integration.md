# Total Express Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Total Express as a fourth carrier option in the freight quotation flow, with admin configuration panel, SOAP-based quote, REST Smart Label order creation, and REST tracking.

**Architecture:** Follows the identical pattern of J&T/Loggi integrations — a `platform/integrations/total-express/` folder with types, client, cotacao, order, tracking, adapter, and volume validator. Cotação uses SOAP 1.1 (one parallel call per service type: EXP, ESP, PRM, STD). Order registration and tracking use REST JSON with Basic Auth.

**Tech Stack:** TypeScript, Next.js 16 App Router, Prisma (Carrier + CarrierCredential models), Ant Design v5, React Query, Zod, Node.js `Buffer.from` for Basic Auth base64, manual XML string building for SOAP (no library needed).

---

## File Map

**New files:**
- `platform/integrations/total-express/types.ts` — TE-specific TypeScript interfaces
- `platform/integrations/total-express/constants.ts` — endpoints, service type codes, limits
- `platform/integrations/total-express/client.ts` — Basic Auth config loader, REST fetch wrapper, SOAP call builder
- `platform/integrations/total-express/total-express-volume-validator.ts` — CarrierVolumeValidator implementation
- `platform/integrations/total-express/cotacao.ts` — 4 parallel SOAP calls → QuoteResultItem[]
- `platform/integrations/total-express/order.ts` — Smart Label REST registration
- `platform/integrations/total-express/tracking.ts` — REST tracking by AWB
- `platform/integrations/total-express/adapter.ts` — quoteFromTotalExpress (main integration point)
- `platform/integrations/total-express/index.ts` — barrel exports
- `app/(admin)/admin/total-express/page.tsx` — server component wrapper
- `app/(admin)/admin/total-express/loading.tsx` — Suspense fallback
- `app/(admin)/admin/total-express/TotalExpressClient.tsx` — admin UI (config + tests)
- `app/api/admin/integrations/total-express/route.ts` — GET/POST config
- `app/api/admin/integrations/total-express/test/route.ts` — POST test runner

**Modified files:**
- `platform/integrations/shared/circuit-breaker.ts` — add `totalExpressCircuitBreaker` instance
- `platform/integrations/shared/eligibility-service.ts` — register `totalExpressVolumeValidator`
- `modules/quotes/application/service.ts` — add Total Express quote block
- `modules/admin/application/nav.ts` — add Total Express to Integrações menu

---

## Task 1: Foundation — types.ts + constants.ts

**Files:**
- Create: `platform/integrations/total-express/types.ts`
- Create: `platform/integrations/total-express/constants.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// platform/integrations/total-express/types.ts

// ============================================================================
// Configuração
// ============================================================================

export interface TEConfig {
  environment: 'sandbox' | 'production';
  apiBase: string;
  soapBase: string;
  username: string;
  password: string;
  remetenteId: string;
  cnpj: string;
}

// ============================================================================
// Cotação (SOAP)
// ============================================================================

export interface TECotacaoInput {
  cepOrigem: string;
  cepDestino: string;
  pesoG: number;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  valorDeclaradoCentavos?: number;
}

export interface TECotacaoResult {
  tipoServico: string;
  prazo: number;
  valorCentavos: number;
}

// ============================================================================
// Smart Label (Order Registration)
// ============================================================================

export interface TEAddress {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  telefone?: string;
  email?: string;
  cnpjCpf?: string;
}

export interface TEVolume {
  peso: number;
  comprimento: number;
  largura: number;
  altura: number;
}

export interface TENotaFiscal {
  numero: string;
  serie: string;
  chaveAcesso: string;
  dataEmissao?: string;
  valorTotal: number;
}

export interface TESmartLabelRequest {
  tipo_servico: string;
  tipo_entrega: string;
  remetente: TEAddress;
  destinatario: TEAddress;
  volumes: TEVolume[];
  conteudo?: string;
  nota_fiscal?: TENotaFiscal;
  numero_pedido?: string;
  valor_declarado?: number;
}

export interface TESmartLabelVolumeResponse {
  awb: string;
  status: number;
  mensagem?: string;
}

export interface TESmartLabelResponse {
  status: number;
  mensagem?: string;
  volumes?: TESmartLabelVolumeResponse[];
  awb?: string;
}

// ============================================================================
// Tracking
// ============================================================================

export interface TETrackingEvent {
  data: string;
  hora?: string;
  status: string;
  descricao: string;
  local?: string;
}

export interface TETrackingPackage {
  awb: string;
  status_atual: string;
  previsao_entrega?: string;
  eventos: TETrackingEvent[];
}

export interface TETrackingResponse {
  status: number;
  mensagem?: string;
  encomendas?: TETrackingPackage[];
}

// ============================================================================
// Erros
// ============================================================================

export class TEApiError extends Error {
  public readonly code: string | number;
  public readonly apiMessage: string;

  constructor(code: string | number, apiMessage: string) {
    super(`Total Express API Error [${code}]: ${apiMessage}`);
    this.name = 'TEApiError';
    this.code = code;
    this.apiMessage = apiMessage;
  }
}

export class TEAuthError extends Error {
  constructor(message: string) {
    super(`Total Express Auth Error: ${message}`);
    this.name = 'TEAuthError';
  }
}

export interface TEAuthTestResult {
  success: boolean;
  message: string;
  error?: string;
  latencyMs: number;
}
```

- [ ] **Step 2: Create constants.ts**

```typescript
// platform/integrations/total-express/constants.ts
import 'server-only';

// ============================================================================
// URLs Base
// NOTE: Total Express uses the same endpoints for all environments;
// sandbox testing uses test credentials, not a separate base URL.
// ============================================================================

export const TE_API_BASE = 'https://apis.totalexpress.com.br';
export const TE_SOAP_BASE = 'https://edi.totalexpress.com.br';

// ============================================================================
// Endpoints
// ============================================================================

export const TE_ENDPOINTS = {
  /** SOAP: Cálculo de Frete v2.0 */
  calcFrete: '/webservice_calculo_frete_v2.php',
  /** REST: Smart Label v3.5 — criação de pedido */
  smartLabel: '/ics-edi-lv/v1/coleta/smartlabel/registrar',
  /** REST: Status de Entrega v1.0 — rastreamento */
  tracking: '/ics-tracking-encomenda-lv/v1/tracking',
} as const;

// ============================================================================
// Tipos de Serviço
// IMPORTANT: Verify these codes match the Cálculo de Frete v2.0 PDF exactly.
// ============================================================================

export const TE_SERVICE_TYPES = {
  /** Expresso — entrega em 1-2 dias úteis */
  EXP: 'EXP',
  /** Especial/Econômico — entrega em 3-5 dias úteis */
  ESP: 'ESP',
  /** Premium — serviço diferenciado */
  PRM: 'PRM',
  /** Standard — padrão */
  STD: 'STD',
} as const;

export type TEServiceType = (typeof TE_SERVICE_TYPES)[keyof typeof TE_SERVICE_TYPES];

export const TE_SERVICE_LABELS: Record<TEServiceType, string> = {
  EXP: 'Total Express Expresso',
  ESP: 'Total Express Econômico',
  PRM: 'Total Express Premium',
  STD: 'Total Express Standard',
};

// ============================================================================
// Tipo de Entrega (Smart Label)
// ============================================================================

export const TE_DELIVERY_TYPES = {
  /** Entrega domiciliar padrão */
  NORMAL: 'D',
} as const;

// ============================================================================
// Limites de Volumes
// Adjust these if the PDF specifies different limits.
// ============================================================================

export const TE_VOLUME_RULES = {
  /** Peso máximo real em kg */
  MAX_PESO_KG: 30,
  /** Maior lado máximo em cm */
  MAX_LADO_CM: 70,
  /** Soma dos lados máxima em cm */
  MAX_SOMA_LADOS_CM: 200,
  /** Fator de cubagem */
  CUBAGE_FACTOR: 6000,
} as const;

// ============================================================================
// Carrier Info
// ============================================================================

export const TE_CARRIER_SLUG = 'total-express';
export const TE_CARRIER_NAME = 'Total Express';
export const TE_DEFAULT_LOGO_URL = 'https://www.totalexpress.com.br/wp-content/uploads/2021/03/logo-total-express.png';

// ============================================================================
// SOAP Configuration
// These match the Cálculo de Frete v2.0 WSDL.
// IMPORTANT: If the SOAP calls fail with namespace errors, check the WSDL at:
// https://edi.totalexpress.com.br/webservice_calculo_frete_v2.php?wsdl
// and adjust TE_SOAP_NAMESPACE and TE_SOAP_ACTION_BASE below.
// ============================================================================

export const TE_SOAP_NAMESPACE = 'urn:webservice_calculo_frete_v2';
export const TE_SOAP_ACTION_BASE = 'urn:webservice_calculo_frete_v2#CalcFrete';
```

- [ ] **Step 3: Commit**

```bash
git add platform/integrations/total-express/types.ts platform/integrations/total-express/constants.ts
git commit -m "feat(total-express): add types and constants"
```

---

## Task 2: client.ts — HTTP Client (Basic Auth + SOAP builder)

**Files:**
- Create: `platform/integrations/total-express/client.ts`

- [ ] **Step 1: Create client.ts**

```typescript
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
      try { remetenteId = decrypt(customData.remetenteId as string); } catch { remetenteId = customData.remetenteId as string; }
    }

    let cnpj = '';
    if (customData.cnpj) {
      try { cnpj = decrypt(customData.cnpj as string); } catch { cnpj = customData.cnpj as string; }
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

function buildSoapEnvelope(params: TESoapParams): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns1="${TE_SOAP_NAMESPACE}">
  <SOAP-ENV:Body>
    <ns1:CalcFrete>
      <Remetente_ID>${params.Remetente_ID}</Remetente_ID>
      <CEP_Origem>${params.CEP_Origem}</CEP_Origem>
      <CEP_Destino>${params.CEP_Destino}</CEP_Destino>
      <Tipo_Servico>${params.Tipo_Servico}</Tipo_Servico>
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
      message: 'Falha na autenticação',
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/integrations/total-express/client.ts
git commit -m "feat(total-express): add HTTP client with Basic Auth and SOAP builder"
```

---

## Task 3: Volume Validator

**Files:**
- Create: `platform/integrations/total-express/total-express-volume-validator.ts`

- [ ] **Step 1: Create total-express-volume-validator.ts**

```typescript
// platform/integrations/total-express/total-express-volume-validator.ts

import type {
  CarrierVolumeValidator,
  VolumeInput,
  VolumeValidationResult,
  VolumeComputedValues,
} from '../shared/volume-eligibility';
import { TE_VOLUME_RULES, TE_CARRIER_SLUG, TE_CARRIER_NAME } from './constants';

export function computeTEVolumeValues(volume: VolumeInput): VolumeComputedValues {
  const pesoRealKg = volume.pesoKg;
  const pesoCubadoKg =
    (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) /
    TE_VOLUME_RULES.CUBAGE_FACTOR;
  const chargeableWeightKg = Math.max(pesoRealKg, pesoCubadoKg);

  const dims = [volume.comprimentoCm, volume.larguraCm, volume.alturaCm].sort(
    (a, b) => a - b
  ) as [number, number, number];

  return {
    pesoRealKg,
    pesoCubadoKg,
    chargeableWeightKg,
    maiorLadoCm: dims[2],
    somaDimensoesCm: dims[0] + dims[1] + dims[2],
    dimsOrdenadas: dims,
  };
}

export class TotalExpressVolumeValidator implements CarrierVolumeValidator {
  readonly carrierId = TE_CARRIER_SLUG;
  readonly carrierName = TE_CARRIER_NAME;

  validateVolume(volume: VolumeInput): VolumeValidationResult {
    const reasons: string[] = [];
    const computed = computeTEVolumeValues(volume);

    if (volume.comprimentoCm <= 0 || volume.larguraCm <= 0 || volume.alturaCm <= 0) {
      reasons.push('Todas as dimensões devem ser maiores que zero');
    }

    if (volume.pesoKg <= 0) {
      reasons.push('Peso deve ser maior que zero');
    }

    if (computed.chargeableWeightKg > TE_VOLUME_RULES.MAX_PESO_KG) {
      reasons.push(
        `Peso para cobrança (${computed.chargeableWeightKg.toFixed(2)}kg) excede ${TE_VOLUME_RULES.MAX_PESO_KG}kg (Total Express)`
      );
    }

    if (computed.maiorLadoCm > TE_VOLUME_RULES.MAX_LADO_CM) {
      reasons.push(
        `Maior lado (${computed.maiorLadoCm}cm) excede ${TE_VOLUME_RULES.MAX_LADO_CM}cm (Total Express)`
      );
    }

    if (computed.somaDimensoesCm > TE_VOLUME_RULES.MAX_SOMA_LADOS_CM) {
      reasons.push(
        `Soma dos lados (${computed.somaDimensoesCm}cm) excede ${TE_VOLUME_RULES.MAX_SOMA_LADOS_CM}cm (Total Express)`
      );
    }

    return {
      volumeIndex: volume.index,
      isValid: reasons.length === 0,
      reasons,
      computed,
    };
  }

  canQuoteAllVolumes(volumes: VolumeInput[]): boolean {
    return volumes.every((v) => this.validateVolume(v).isValid);
  }
}

export const totalExpressVolumeValidator = new TotalExpressVolumeValidator();
```

- [ ] **Step 2: Commit**

```bash
git add platform/integrations/total-express/total-express-volume-validator.ts
git commit -m "feat(total-express): add volume validator"
```

---

## Task 4: cotacao.ts — 4 parallel SOAP calls

**Files:**
- Create: `platform/integrations/total-express/cotacao.ts`

- [ ] **Step 1: Create cotacao.ts**

```typescript
// platform/integrations/total-express/cotacao.ts
import 'server-only';

import type { TECotacaoInput, TECotacaoResult } from './types';
import { TEApiError } from './types';
import { TE_SERVICE_TYPES, type TEServiceType } from './constants';
import { teSoapCalcFrete, getTEConfigAsync } from './client';

/**
 * Queries all 4 service types in parallel via SOAP.
 * Returns only those that returned a valid price > 0.
 * For multi-volume requests, caller should pass totals:
 *   pesoG = sum of all volumes
 *   comprimento/largura/altura = max across all volumes
 */
export async function cotarTE(input: TECotacaoInput): Promise<TECotacaoResult[]> {
  const cepOrigem = input.cepOrigem.replace(/\D/g, '');
  const cepDestino = input.cepDestino.replace(/\D/g, '');

  if (cepOrigem.length !== 8) throw new TEApiError('VALIDATION', `CEP origem inválido: ${input.cepOrigem}`);
  if (cepDestino.length !== 8) throw new TEApiError('VALIDATION', `CEP destino inválido: ${input.cepDestino}`);
  if (input.pesoG <= 0) throw new TEApiError('VALIDATION', 'Peso deve ser maior que zero');

  const config = await getTEConfigAsync();

  const serviceTypes: TEServiceType[] = [
    TE_SERVICE_TYPES.EXP,
    TE_SERVICE_TYPES.ESP,
    TE_SERVICE_TYPES.PRM,
    TE_SERVICE_TYPES.STD,
  ];

  const results = await Promise.allSettled(
    serviceTypes.map(async (tipoServico) => {
      const soapResult = await teSoapCalcFrete({
        Remetente_ID: config.remetenteId,
        CEP_Origem: cepOrigem,
        CEP_Destino: cepDestino,
        Tipo_Servico: tipoServico,
        Peso: input.pesoG,
        Comp: Math.round(input.comprimentoCm),
        Larg: Math.round(input.larguraCm),
        Alt: Math.round(input.alturaCm),
        Valor_Coleta: input.valorDeclaradoCentavos,
      });

      if (soapResult.Prazo <= 0 || soapResult.ValorServico <= 0) {
        return null;
      }

      return {
        tipoServico,
        prazo: soapResult.Prazo,
        valorCentavos: Math.round(soapResult.ValorServico * 100),
      } satisfies TECotacaoResult;
    })
  );

  const cotacoes: TECotacaoResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      cotacoes.push(result.value);
    } else if (result.status === 'rejected') {
      console.warn('[TE_COTACAO] Service type failed:', result.reason);
    }
  }

  return cotacoes;
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/integrations/total-express/cotacao.ts
git commit -m "feat(total-express): add SOAP freight quotation (4 service types)"
```

---

## Task 5: order.ts — Smart Label registration

**Files:**
- Create: `platform/integrations/total-express/order.ts`

- [ ] **Step 1: Create order.ts**

```typescript
// platform/integrations/total-express/order.ts
import 'server-only';

import type {
  TESmartLabelRequest,
  TESmartLabelResponse,
} from './types';
import { TEApiError } from './types';
import { TE_ENDPOINTS, TE_DELIVERY_TYPES } from './constants';
import { teFetch } from './client';

export interface CreateTEOrderInput {
  tipo_servico: string;
  numero_pedido?: string;
  remetente: {
    nome: string;
    cnpjCpf: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
    telefone?: string;
    email?: string;
  };
  destinatario: {
    nome: string;
    cnpjCpf?: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
    telefone?: string;
    email?: string;
  };
  volumes: Array<{
    pesoKg: number;
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
  }>;
  conteudo?: string;
  valorDeclarado?: number;
  notaFiscal?: {
    numero: string;
    serie: string;
    chaveAcesso: string;
    valorTotal: number;
    dataEmissao?: string;
  };
}

export async function createTEOrder(
  input: CreateTEOrderInput
): Promise<TESmartLabelResponse> {
  if (!input.tipo_servico) throw new TEApiError('VALIDATION', 'tipo_servico é obrigatório');
  if (!input.remetente?.cep) throw new TEApiError('VALIDATION', 'CEP do remetente é obrigatório');
  if (!input.destinatario?.cep) throw new TEApiError('VALIDATION', 'CEP do destinatário é obrigatório');
  if (!input.volumes?.length) throw new TEApiError('VALIDATION', 'Ao menos um volume é obrigatório');

  const body: TESmartLabelRequest = {
    tipo_servico: input.tipo_servico,
    tipo_entrega: TE_DELIVERY_TYPES.NORMAL,
    remetente: {
      nome: input.remetente.nome,
      cnpjCpf: input.remetente.cnpjCpf,
      logradouro: input.remetente.logradouro,
      numero: input.remetente.numero,
      complemento: input.remetente.complemento,
      bairro: input.remetente.bairro,
      cep: input.remetente.cep.replace(/\D/g, ''),
      cidade: input.remetente.cidade,
      uf: input.remetente.uf,
      telefone: input.remetente.telefone,
      email: input.remetente.email,
    },
    destinatario: {
      nome: input.destinatario.nome,
      cnpjCpf: input.destinatario.cnpjCpf,
      logradouro: input.destinatario.logradouro,
      numero: input.destinatario.numero,
      complemento: input.destinatario.complemento,
      bairro: input.destinatario.bairro,
      cep: input.destinatario.cep.replace(/\D/g, ''),
      cidade: input.destinatario.cidade,
      uf: input.destinatario.uf,
      telefone: input.destinatario.telefone,
      email: input.destinatario.email,
    },
    volumes: input.volumes.map((v) => ({
      peso: Math.round(v.pesoKg * 1000),
      comprimento: Math.round(v.comprimentoCm),
      largura: Math.round(v.larguraCm),
      altura: Math.round(v.alturaCm),
    })),
    conteudo: input.conteudo || 'Mercadoria',
    valor_declarado: input.valorDeclarado,
    numero_pedido: input.numero_pedido,
    nota_fiscal: input.notaFiscal ? {
      numero: input.notaFiscal.numero,
      serie: input.notaFiscal.serie,
      chaveAcesso: input.notaFiscal.chaveAcesso,
      valorTotal: input.notaFiscal.valorTotal,
      dataEmissao: input.notaFiscal.dataEmissao,
    } : undefined,
  };

  console.log('[TE_ORDER] Creating Smart Label order:', {
    tipo_servico: input.tipo_servico,
    numero_pedido: input.numero_pedido,
    remetenteCep: input.remetente.cep,
    destinatarioCep: input.destinatario.cep,
    volumes: input.volumes.length,
  });

  const response = await teFetch<TESmartLabelResponse>(TE_ENDPOINTS.smartLabel, {
    method: 'POST',
    body: body as unknown as Record<string, unknown>,
  });

  console.log('[TE_ORDER] Smart Label response:', {
    status: response.status,
    awb: response.awb || response.volumes?.[0]?.awb,
    volumes: response.volumes?.length,
  });

  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/integrations/total-express/order.ts
git commit -m "feat(total-express): add Smart Label order creation"
```

---

## Task 6: tracking.ts

**Files:**
- Create: `platform/integrations/total-express/tracking.ts`

- [ ] **Step 1: Create tracking.ts**

```typescript
// platform/integrations/total-express/tracking.ts
import 'server-only';

import type { TETrackingResponse } from './types';
import { TEApiError } from './types';
import { TE_ENDPOINTS } from './constants';
import { teFetch } from './client';

export async function getTETracking(awb: string): Promise<TETrackingResponse> {
  if (!awb) throw new TEApiError('VALIDATION', 'AWB é obrigatório para rastreamento');

  console.log('[TE_TRACKING] Querying tracking for AWB:', awb);

  const response = await teFetch<TETrackingResponse>(TE_ENDPOINTS.tracking, {
    method: 'GET',
    query: { awb },
  });

  console.log('[TE_TRACKING] Response:', {
    status: response.status,
    encomendas: response.encomendas?.length || 0,
  });

  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/integrations/total-express/tracking.ts
git commit -m "feat(total-express): add tracking"
```

---

## Task 7: adapter.ts — Main integration point

**Files:**
- Create: `platform/integrations/total-express/adapter.ts`

- [ ] **Step 1: Create adapter.ts**

```typescript
// platform/integrations/total-express/adapter.ts
import 'server-only';

import type { QuoteResultItem } from '@/shared/types/quote';
import type { QuoteRequest } from '@/shared/validation/quote-backend';
import { cotarTE } from './cotacao';
import { getTEConfigAsync, validateTEConfig } from './client';
import { totalExpressVolumeValidator } from './total-express-volume-validator';
import { TE_CARRIER_SLUG, TE_CARRIER_NAME, TE_SERVICE_LABELS, type TEServiceType } from './constants';
import type { VolumeInput, CarrierEligibility } from '../shared/volume-eligibility';

export const TE_CARRIER_ID = TE_CARRIER_SLUG;
export { TE_CARRIER_NAME };

export type TEQuoteResult = {
  results: QuoteResultItem[];
  source: 'real' | 'error';
  error?: string;
  eligibility?: CarrierEligibility;
};

export async function isTotalExpressAvailableAsync(): Promise<boolean> {
  const config = await getTEConfigAsync();
  return validateTEConfig(config).valid;
}

/**
 * For multi-volume requests:
 * - pesoG = sum of all volumes (grams)
 * - dimensions = max across all volumes (Total Express takes a single set of dims)
 */
export async function quoteFromTotalExpress(
  request: QuoteRequest
): Promise<TEQuoteResult> {
  const requestId = `te_${Date.now()}`;

  console.log('[TE_ADAPTER] Starting quote:', {
    requestId,
    origem: request.origem.cep,
    destino: request.destino.cep,
    volumes: request.volumes.length,
  });

  // 1. Validate volume eligibility
  const volumeInputs: VolumeInput[] = request.volumes.map((vol, index) => ({
    index,
    comprimentoCm: vol.comprimentoCm,
    larguraCm: vol.larguraCm,
    alturaCm: vol.alturaCm,
    pesoKg: vol.pesoKg,
  }));

  const volumeValidations = volumeInputs.map((v) =>
    totalExpressVolumeValidator.validateVolume(v)
  );
  const isEligible = volumeValidations.every((r) => r.isValid);

  const eligibility: CarrierEligibility = {
    carrierId: totalExpressVolumeValidator.carrierId,
    carrierName: totalExpressVolumeValidator.carrierName,
    isEligible,
    volumeResults: volumeValidations,
    overallReasons: isEligible
      ? []
      : [...new Set(volumeValidations.flatMap((r) => r.reasons))],
  };

  if (!isEligible) {
    console.log('[TE_ADAPTER] Volumes not eligible:', {
      requestId,
      invalidVolumes: volumeValidations
        .filter((r) => !r.isValid)
        .map((r) => ({ index: r.volumeIndex, reasons: r.reasons })),
    });
    return { results: [], source: 'real', eligibility };
  }

  // 2. Check if integration is configured
  const isConfigured = await isTotalExpressAvailableAsync();
  if (!isConfigured) {
    console.warn('[TE_ADAPTER] Integration not configured');
    return { results: [], source: 'error', error: 'INTEGRATION_DISABLED', eligibility };
  }

  try {
    // 3. Aggregate volumes: sum weights, use max dimensions
    const pesoTotalG = Math.round(
      request.volumes.reduce((sum, v) => sum + v.pesoKg, 0) * 1000
    );
    const comprimentoCm = Math.max(...request.volumes.map((v) => v.comprimentoCm));
    const larguraCm = Math.max(...request.volumes.map((v) => v.larguraCm));
    const alturaCm = Math.max(...request.volumes.map((v) => v.alturaCm));

    // 4. Quote all service types in parallel
    const cotacoes = await cotarTE({
      cepOrigem: request.origem.cep,
      cepDestino: request.destino.cep,
      pesoG: pesoTotalG,
      comprimentoCm,
      larguraCm,
      alturaCm,
      valorDeclaradoCentavos: request.seguro ? Math.round(request.seguro * 100) : undefined,
    });

    // 5. Convert to internal format
    const results: QuoteResultItem[] = cotacoes.map((c) => ({
      id: `${TE_CARRIER_ID}-${c.tipoServico.toLowerCase()}`,
      carrier: TE_CARRIER_NAME,
      modalidade: TE_SERVICE_LABELS[c.tipoServico as TEServiceType] ?? `Total Express ${c.tipoServico}`,
      prazoDias: c.prazo,
      preco: c.valorCentavos / 100,
      exigeSeguro: false,
      source: 'real' as const,
    }));

    console.log('[TE_ADAPTER] Quote completed:', {
      requestId,
      total: results.length,
      options: results.map((r) => ({ id: r.id, preco: r.preco, prazo: r.prazoDias })),
    });

    return { results, source: 'real', eligibility };
  } catch (error) {
    console.error('[TE_ADAPTER] Quote failed:', {
      requestId,
      error: error instanceof Error ? error.message : error,
    });

    return {
      results: [],
      source: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      eligibility,
    };
  }
}

export function isTEService(serviceId: string): boolean {
  return serviceId.startsWith(TE_CARRIER_ID + '-');
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/integrations/total-express/adapter.ts
git commit -m "feat(total-express): add adapter (quoteFromTotalExpress)"
```

---

## Task 8: index.ts — Barrel exports

**Files:**
- Create: `platform/integrations/total-express/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// platform/integrations/total-express/index.ts

// Constants
export {
  TE_API_BASE,
  TE_SOAP_BASE,
  TE_ENDPOINTS,
  TE_SERVICE_TYPES,
  TE_SERVICE_LABELS,
  TE_DELIVERY_TYPES,
  TE_VOLUME_RULES,
  TE_CARRIER_SLUG,
  TE_CARRIER_NAME,
  TE_DEFAULT_LOGO_URL,
  TE_SOAP_NAMESPACE,
  TE_SOAP_ACTION_BASE,
} from './constants';
export type { TEServiceType } from './constants';

// Types
export type {
  TEConfig,
  TECotacaoInput,
  TECotacaoResult,
  TEAddress,
  TEVolume,
  TENotaFiscal,
  TESmartLabelRequest,
  TESmartLabelVolumeResponse,
  TESmartLabelResponse,
  TETrackingEvent,
  TETrackingPackage,
  TETrackingResponse,
  TEAuthTestResult,
} from './types';
export { TEApiError, TEAuthError } from './types';

// Client
export {
  getTEConfigAsync,
  validateTEConfig,
  invalidateTEConfigCache,
  teFetch,
  teSoapCalcFrete,
  testTEAuth,
} from './client';
export type { TESoapParams, TESoapResult } from './client';

// Cotação
export { cotarTE } from './cotacao';

// Order
export { createTEOrder } from './order';
export type { CreateTEOrderInput } from './order';

// Tracking
export { getTETracking } from './tracking';

// Adapter
export {
  TE_CARRIER_ID,
  isTotalExpressAvailableAsync,
  quoteFromTotalExpress,
  isTEService,
} from './adapter';
export type { TEQuoteResult } from './adapter';

// Volume Validator
export {
  totalExpressVolumeValidator,
  TotalExpressVolumeValidator,
  TE_VOLUME_RULES as TE_VOLUME_RULES_VALIDATOR,
} from './total-express-volume-validator';
```

- [ ] **Step 2: Commit**

```bash
git add platform/integrations/total-express/index.ts
git commit -m "feat(total-express): add barrel exports"
```

---

## Task 9: Update shared files

**Files:**
- Modify: `platform/integrations/shared/circuit-breaker.ts`
- Modify: `platform/integrations/shared/eligibility-service.ts`

- [ ] **Step 1: Add totalExpressCircuitBreaker to circuit-breaker.ts**

Open `platform/integrations/shared/circuit-breaker.ts` and add at the end of the file, after `loggiCircuitBreaker`:

```typescript
export const totalExpressCircuitBreaker = new CircuitBreaker({
  name: 'total-express',
  failureThreshold: 5,
  resetTimeoutMs: 15000,
  successThreshold: 1,
  callTimeoutMs: 30000,
});
```

- [ ] **Step 2: Add totalExpressVolumeValidator to eligibility-service.ts**

Open `platform/integrations/shared/eligibility-service.ts` and:

1. Add import at the top with the other carrier imports:
```typescript
import { totalExpressVolumeValidator } from '../total-express/total-express-volume-validator';
```

2. Add inside the `EligibilityService` constructor, after `this.registerValidator(loggiVolumeValidator)`:
```typescript
this.registerValidator(totalExpressVolumeValidator);
```

- [ ] **Step 3: Commit**

```bash
git add platform/integrations/shared/circuit-breaker.ts platform/integrations/shared/eligibility-service.ts
git commit -m "feat(total-express): register in circuit breaker and eligibility service"
```

---

## Task 10: Update quote service

**Files:**
- Modify: `modules/quotes/application/service.ts`

- [ ] **Step 1: Add Total Express block to calculateShippingOptions**

Open `modules/quotes/application/service.ts`.

After the Loggi block (around line 262), before the final `return { results, eligibility }`, add:

```typescript
  // Total Express
  const teEligibility = eligibility.carriers.find(
    (c) => c.carrierId === 'total-express'
  );

  if (teEligibility?.isEligible) {
    const { isTotalExpressAvailableAsync, quoteFromTotalExpress } = await import(
      '@/platform/integrations/total-express'
    );
    const isAvailable = await isTotalExpressAvailableAsync();

    if (isAvailable) {
      try {
        const teResult = await quoteFromTotalExpress(request);

        if (teResult.results.length > 0) {
          results.push(...teResult.results);
        }

        console.info(`[QUOTE][${requestId}] Total Express quote completed`, {
          results: teResult.results.length,
        });
      } catch (error) {
        console.error(`[QUOTE][${requestId}] Total Express quote failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      console.warn(`[QUOTE][${requestId}] Total Express not configured`);
    }
  } else if (teEligibility) {
    console.info(`[QUOTE][${requestId}] Total Express not eligible`, {
      reasons: teEligibility.overallReasons || [],
    });
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/fernando-giovanetti/Área de trabalho/envio_legal" && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to total-express imports.

- [ ] **Step 3: Commit**

```bash
git add modules/quotes/application/service.ts
git commit -m "feat(total-express): add to quote service"
```

---

## Task 11: Update admin navigation

**Files:**
- Modify: `modules/admin/application/nav.ts`

- [ ] **Step 1: Add Total Express to ADMIN_NAV**

Open `modules/admin/application/nav.ts`. Inside the `integracoes` children array, after the Loggi entry and before the workers entry, add:

```typescript
      {
        key: 'total-express',
        label: 'Total Express',
        href: '/admin/total-express',
        permissions: ['INTEGRACOES'],
      },
```

- [ ] **Step 2: Commit**

```bash
git add modules/admin/application/nav.ts
git commit -m "feat(total-express): add admin nav item"
```

---

## Task 12: Admin API routes

**Files:**
- Create: `app/api/admin/integrations/total-express/route.ts`
- Create: `app/api/admin/integrations/total-express/test/route.ts`

- [ ] **Step 1: Create route.ts (GET + POST config)**

```typescript
// app/api/admin/integrations/total-express/route.ts

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, Prisma } from '@prisma/client';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { invalidateTEConfigCache } from '@/platform/integrations/total-express';
import { invalidateCarrierCommissionCache } from '@/modules/quotes/application/commission';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

const TE_CARRIER_SLUG = 'total-express';

const environmentCredentialsSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  remetenteId: z.string().optional(),
  cnpj: z.string().optional(),
});

const teConfigSchema = z.object({
  activeEnvironment: z.enum(['sandbox', 'production']).default('production'),
  production: environmentCredentialsSchema.optional(),
  sandbox: environmentCredentialsSchema.optional(),
  shippingCommissionPercent: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .nullable(),
  carrierIconPath: z.string().optional().nullable(),
});

type TEConfigInput = z.infer<typeof teConfigSchema>;

function processCredentials(
  credential: {
    username: string | null;
    password: string | null;
    customHeaders: unknown;
  } | null,
  shouldReveal: boolean
): {
  username: string;
  password: string;
  remetenteId: string;
  cnpj: string;
  passwordDecryptionFailed: boolean;
  configured: boolean;
} {
  if (!credential) {
    return { username: '', password: '', remetenteId: '', cnpj: '', passwordDecryptionFailed: false, configured: false };
  }

  const customData = (credential.customHeaders as Record<string, unknown>) || {};

  let passwordValue = '';
  let passwordDecryptionFailed = false;
  if (credential.password) {
    try {
      const decrypted = decrypt(credential.password);
      passwordValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      passwordDecryptionFailed = true;
    }
  }

  let remetenteId = '';
  if (customData.remetenteId) {
    try {
      const decrypted = decrypt(customData.remetenteId as string);
      remetenteId = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      remetenteId = customData.remetenteId as string;
    }
  }

  let cnpj = '';
  if (customData.cnpj) {
    try {
      const decrypted = decrypt(customData.cnpj as string);
      cnpj = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      cnpj = customData.cnpj as string;
    }
  }

  return {
    username: credential.username || '',
    password: passwordValue,
    remetenteId,
    cnpj,
    passwordDecryptionFailed,
    configured: !!(credential.username && credential.password && remetenteId && cnpj),
  };
}

export const GET = withApiHandler(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  const carrier = await prisma.carrier.findFirst({ where: { slug: TE_CARRIER_SLUG } });

  if (!carrier) {
    return {
      data: {
        configured: false,
        activeEnvironment: 'production' as const,
        production: { configured: false, username: '', password: '', remetenteId: '', cnpj: '' },
        sandbox: { configured: false, username: '', password: '', remetenteId: '', cnpj: '' },
        shippingCommissionPercent: null as number | null,
        carrierIconPath: null as string | null,
        status: null as string | null,
        lastUpdated: null as Date | null,
      },
    };
  }

  const [productionCred, sandboxCred] = await Promise.all([
    prisma.carrierCredential.findFirst({
      where: { carrierId: carrier.id, environment: 'PRODUCTION', isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.carrierCredential.findFirst({
      where: { carrierId: carrier.id, environment: 'SANDBOX', isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const productionData = processCredentials(productionCred, shouldReveal);
  const sandboxData = processCredentials(sandboxCred, shouldReveal);

  return {
    data: {
      configured: productionData.configured || sandboxData.configured,
      activeEnvironment: (carrier.environment === 'SANDBOX' ? 'sandbox' : 'production') as 'sandbox' | 'production',
      production: productionData,
      sandbox: sandboxData,
      shippingCommissionPercent: carrier.shippingCommissionPercent
        ? Number(carrier.shippingCommissionPercent)
        : null,
      carrierIconPath: carrier.logoUrl || null,
      status: carrier.status as string | null,
      lastUpdated: (productionCred?.updatedAt || sandboxCred?.updatedAt || carrier.updatedAt) as Date | null,
    },
  };
});

export const POST = withApiHandler(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = teConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', status: 400, details: parsed.error.flatten() });
  }

  const data: TEConfigInput = parsed.data;

  const hasProdCreds = data.production?.username && data.production?.password
    && data.production?.remetenteId && data.production?.cnpj;
  const hasSandboxCreds = data.sandbox?.username && data.sandbox?.password
    && data.sandbox?.remetenteId && data.sandbox?.cnpj;

  if (!hasProdCreds && !hasSandboxCreds) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Configure ao menos um ambiente com Usuário, Senha, Remetente ID e CNPJ',
      status: 400,
    });
  }

  let carrier = await prisma.carrier.findFirst({ where: { slug: TE_CARRIER_SLUG } });

  await prisma.$transaction(async (tx) => {
    if (!carrier) {
      carrier = await tx.carrier.create({
        data: {
          name: 'Total Express',
          slug: TE_CARRIER_SLUG,
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: 'https://apis.totalexpress.com.br',
          timeout: 30000,
          maxRetries: 3,
          logoUrl: data.carrierIconPath || 'https://www.totalexpress.com.br/wp-content/uploads/2021/03/logo-total-express.png',
          description: 'Integração com APIs da Total Express',
          shippingCommissionPercent: data.shippingCommissionPercent ?? null,
        },
      });
    } else {
      carrier = await tx.carrier.update({
        where: { id: carrier.id },
        data: {
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          logoUrl: data.carrierIconPath ?? carrier.logoUrl,
          shippingCommissionPercent: data.shippingCommissionPercent ?? null,
          updatedAt: new Date(),
        },
      });
    }

    if (data.production) await saveEnvCredentials(tx, carrier.id, 'PRODUCTION', data.production);
    if (data.sandbox) await saveEnvCredentials(tx, carrier.id, 'SANDBOX', data.sandbox);
  });

  invalidateTEConfigCache();
  if (carrier) invalidateCarrierCommissionCache(TE_CARRIER_SLUG);

  if (!carrier) {
    throw new ApiError({ code: 'INTERNAL_ERROR', message: 'Erro ao criar/atualizar carrier', status: 500 });
  }

  return {
    data: {
      message: 'Configuração salva com sucesso',
      carrier: { id: carrier.id, slug: carrier.slug, status: carrier.status, activeEnvironment: data.activeEnvironment },
    },
  };
});

async function saveEnvCredentials(
  tx: Prisma.TransactionClient,
  carrierId: string,
  environment: 'PRODUCTION' | 'SANDBOX',
  credentials: z.infer<typeof environmentCredentialsSchema>
) {
  if (!credentials.username && !credentials.password && !credentials.remetenteId && !credentials.cnpj) return;

  const existingCred = await tx.carrierCredential.findFirst({
    where: { carrierId, environment, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  let finalPassword = credentials.password || '';
  if (credentials.password === '***' && existingCred?.password) {
    try { finalPassword = decrypt(existingCred.password); } catch { finalPassword = ''; }
  }

  let finalRemetenteId = credentials.remetenteId || '';
  if (credentials.remetenteId === '***' && existingCred?.customHeaders) {
    const existing = existingCred.customHeaders as Record<string, unknown>;
    if (existing.remetenteId) {
      try { finalRemetenteId = decrypt(existing.remetenteId as string); } catch { finalRemetenteId = existing.remetenteId as string; }
    }
  }

  let finalCnpj = credentials.cnpj || '';
  if (credentials.cnpj === '***' && existingCred?.customHeaders) {
    const existing = existingCred.customHeaders as Record<string, unknown>;
    if (existing.cnpj) {
      try { finalCnpj = decrypt(existing.cnpj as string); } catch { finalCnpj = existing.cnpj as string; }
    }
  }

  if (!credentials.username || !finalPassword || !finalRemetenteId || !finalCnpj) return;

  await tx.carrierCredential.updateMany({
    where: { carrierId, environment, isActive: true },
    data: { isActive: false },
  });

  await tx.carrierCredential.create({
    data: {
      carrierId,
      environment,
      authType: 'BASIC',
      username: credentials.username,
      password: encrypt(finalPassword),
      customHeaders: {
        remetenteId: encrypt(finalRemetenteId),
        cnpj: encrypt(finalCnpj),
      } as Prisma.InputJsonValue,
      isActive: true,
    },
  });
}
```

- [ ] **Step 2: Create test/route.ts**

```typescript
// app/api/admin/integrations/total-express/test/route.ts

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { testTEAuth } from '@/platform/integrations/total-express/client';
import { cotarTE } from '@/platform/integrations/total-express/cotacao';
import { createTEOrder } from '@/platform/integrations/total-express/order';
import { getTETracking } from '@/platform/integrations/total-express/tracking';
import { TEApiError } from '@/platform/integrations/total-express/types';

const testSchema = z.object({
  type: z.enum(['auth', 'quote', 'order', 'tracking']),
  cepOrigem: z.string().optional(),
  cepDestino: z.string().optional(),
  pesoKg: z.number().optional(),
  comprimentoCm: z.number().optional(),
  larguraCm: z.number().optional(),
  alturaCm: z.number().optional(),
  valorDeclarado: z.number().optional(),
  awb: z.string().optional(),
  orderData: z.object({
    tipo_servico: z.string(),
    numero_pedido: z.string().optional(),
    remetente: z.object({
      nome: z.string(),
      cnpjCpf: z.string(),
      logradouro: z.string(),
      numero: z.string(),
      bairro: z.string(),
      cep: z.string(),
      cidade: z.string(),
      uf: z.string(),
      telefone: z.string().optional(),
    }),
    destinatario: z.object({
      nome: z.string(),
      logradouro: z.string(),
      numero: z.string(),
      bairro: z.string(),
      cep: z.string(),
      cidade: z.string(),
      uf: z.string(),
      telefone: z.string().optional(),
    }),
    pesoKg: z.number(),
    comprimentoCm: z.number(),
    larguraCm: z.number(),
    alturaCm: z.number(),
  }).optional(),
});

export const POST = withApiHandler<Record<string, unknown>>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = testSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', status: 400, details: parsed.error.flatten() });
  }

  const { type } = parsed.data;

  switch (type) {
    case 'auth': {
      const result = await testTEAuth();
      return {
        data: {
          success: result.success,
          type: 'auth',
          message: result.message,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      };
    }

    case 'quote': {
      const { cepOrigem, cepDestino, pesoKg } = parsed.data;
      if (!cepOrigem || !cepDestino || !pesoKg) {
        throw new ApiError({ code: 'VALIDATION_ERROR', message: 'cepOrigem, cepDestino e pesoKg são obrigatórios', status: 400 });
      }

      const startTime = Date.now();
      try {
        const cotacoes = await cotarTE({
          cepOrigem,
          cepDestino,
          pesoG: Math.round(pesoKg * 1000),
          comprimentoCm: parsed.data.comprimentoCm || 20,
          larguraCm: parsed.data.larguraCm || 15,
          alturaCm: parsed.data.alturaCm || 10,
          valorDeclaradoCentavos: parsed.data.valorDeclarado ? Math.round(parsed.data.valorDeclarado * 100) : undefined,
        });

        return {
          data: {
            success: true,
            type: 'quote',
            message: `${cotacoes.length} opção(ões) encontradas`,
            result: { cotacoes },
            latencyMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          data: {
            success: false,
            type: 'quote',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            latencyMs: Date.now() - startTime,
            error: error instanceof TEApiError ? { code: error.code, message: error.apiMessage } : undefined,
          },
        };
      }
    }

    case 'order': {
      const orderData = parsed.data.orderData;
      if (!orderData) {
        throw new ApiError({ code: 'VALIDATION_ERROR', message: 'orderData é obrigatório', status: 400 });
      }

      const startTime = Date.now();
      try {
        const response = await createTEOrder({
          tipo_servico: orderData.tipo_servico,
          numero_pedido: orderData.numero_pedido,
          remetente: orderData.remetente,
          destinatario: orderData.destinatario,
          volumes: [{
            pesoKg: orderData.pesoKg,
            comprimentoCm: orderData.comprimentoCm,
            larguraCm: orderData.larguraCm,
            alturaCm: orderData.alturaCm,
          }],
        });

        const awb = response.awb || response.volumes?.[0]?.awb;
        return {
          data: {
            success: response.status === 0 || !!awb,
            type: 'order',
            message: awb ? `Pedido criado. AWB: ${awb}` : `Status: ${response.status} — ${response.mensagem || ''}`,
            result: { awb, response },
            latencyMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          data: {
            success: false,
            type: 'order',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            latencyMs: Date.now() - startTime,
          },
        };
      }
    }

    case 'tracking': {
      const { awb } = parsed.data;
      if (!awb) {
        throw new ApiError({ code: 'VALIDATION_ERROR', message: 'awb é obrigatório', status: 400 });
      }

      const startTime = Date.now();
      try {
        const response = await getTETracking(awb);
        const pkg = response.encomendas?.[0];
        return {
          data: {
            success: true,
            type: 'tracking',
            message: pkg?.status_atual ? `Status: ${pkg.status_atual}` : 'Resposta sem status',
            result: { awb, pkg, eventCount: pkg?.eventos?.length || 0 },
            latencyMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          data: {
            success: false,
            type: 'tracking',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            latencyMs: Date.now() - startTime,
          },
        };
      }
    }
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/integrations/total-express/route.ts app/api/admin/integrations/total-express/test/route.ts
git commit -m "feat(total-express): add admin API routes (config GET/POST + test)"
```

---

## Task 13: Admin UI

**Files:**
- Create: `app/(admin)/admin/total-express/page.tsx`
- Create: `app/(admin)/admin/total-express/loading.tsx`
- Create: `app/(admin)/admin/total-express/TotalExpressClient.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
// app/(admin)/admin/total-express/page.tsx

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import TotalExpressClient from './TotalExpressClient';

export default async function TotalExpressPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <TotalExpressClient />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create loading.tsx**

```typescript
// app/(admin)/admin/total-express/loading.tsx

export default function TotalExpressLoading() {
  return (
    <div style={{ minHeight: '400px', display: 'grid', placeItems: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #1890ff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

- [ ] **Step 3: Create TotalExpressClient.tsx**

```typescript
// app/(admin)/admin/total-express/TotalExpressClient.tsx
'use client';

import { useState, startTransition, useEffect } from 'react';
import {
  Card, Form, Input, Button, Space, Typography, Tabs, Alert, Spin,
  Divider, Tag, InputNumber, Radio, message, Badge, Row, Col,
} from 'antd';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/shared/utils/format';
import {
  SaveOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SearchOutlined, ExperimentOutlined, CloudOutlined, SendOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface EnvironmentCredentials {
  username: string;
  password: string;
  remetenteId: string;
  cnpj: string;
  passwordDecryptionFailed?: boolean;
  configured: boolean;
}

interface TEConfig {
  configured: boolean;
  activeEnvironment: 'sandbox' | 'production';
  production: EnvironmentCredentials;
  sandbox: EnvironmentCredentials;
  shippingCommissionPercent?: number | null;
  carrierIconPath?: string | null;
  status?: string;
  lastUpdated?: string;
}

interface TestResult {
  success: boolean;
  type: string;
  message: string;
  result?: unknown;
  latencyMs?: number;
  error?: unknown;
}

// ============================================================================
// API calls
// ============================================================================

async function fetchConfig(): Promise<TEConfig> {
  const res = await fetch('/api/admin/integrations/total-express?reveal=true');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: Record<string, unknown>): Promise<{ message: string }> {
  const res = await fetch('/api/admin/integrations/total-express', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || err.message || 'Erro ao salvar');
  }
  const json = await res.json();
  return json.data ?? json;
}

async function runTest(data: Record<string, unknown>): Promise<TestResult> {
  const res = await fetch('/api/admin/integrations/total-express/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.data ?? json;
}

// ============================================================================
// Helper component
// ============================================================================

function EnvironmentBadge({ environment, configured }: { environment: 'sandbox' | 'production'; configured: boolean }) {
  if (!configured) return <Tag color="default">Não configurado</Tag>;
  return environment === 'production'
    ? <Tag color="green">Produção</Tag>
    : <Tag color="orange">Homologação</Tag>;
}

// ============================================================================
// Main component
// ============================================================================

export default function TotalExpressClient() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('config');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [quoteForm] = Form.useForm();
  const [orderForm] = Form.useForm();
  const [trackingForm] = Form.useForm();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['te-config'],
    queryFn: fetchConfig,
  });

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: (data) => {
      message.success(data.message || 'Configuração salva com sucesso');
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['te-config'] });
      });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Erro ao salvar configuração');
    },
  });

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        activeEnvironment: config.activeEnvironment,
        shippingCommissionPercent: config.shippingCommissionPercent ?? undefined,
        carrierIconPath: config.carrierIconPath ?? undefined,
        prod_username: config.production?.username,
        prod_password: config.production?.password,
        prod_remetenteId: config.production?.remetenteId,
        prod_cnpj: config.production?.cnpj,
        sandbox_username: config.sandbox?.username,
        sandbox_password: config.sandbox?.password,
        sandbox_remetenteId: config.sandbox?.remetenteId,
        sandbox_cnpj: config.sandbox?.cnpj,
      });
    }
  }, [config, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      saveMutation.mutate({
        activeEnvironment: values.activeEnvironment,
        production: {
          username: values.prod_username,
          password: values.prod_password,
          remetenteId: values.prod_remetenteId,
          cnpj: values.prod_cnpj,
        },
        sandbox: {
          username: values.sandbox_username,
          password: values.sandbox_password,
          remetenteId: values.sandbox_remetenteId,
          cnpj: values.sandbox_cnpj,
        },
        shippingCommissionPercent: values.shippingCommissionPercent,
        carrierIconPath: values.carrierIconPath,
      });
    } catch {
      message.error('Preencha os campos obrigatórios');
    }
  };

  const handleTest = async (type: string, payload?: Record<string, unknown>) => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await runTest({ type, ...payload });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        type,
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" /><p>Carregando...</p></div>;
  }

  if (error) {
    return <div style={{ padding: 24 }}><Alert type="error" message="Erro ao carregar configuração" description={String(error)} /></div>;
  }

  const tabs = [
    {
      key: 'config',
      label: <span><ApiOutlined /> Configuração</span>,
      children: (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="activeEnvironment" label="Ambiente ativo">
                <Radio.Group>
                  <Radio value="production">Produção</Radio>
                  <Radio value="sandbox">Homologação</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Divider>Produção <EnvironmentBadge environment="production" configured={config?.production?.configured ?? false} /></Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prod_username" label="Usuário">
                <Input placeholder="usuário da Total Express" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prod_password" label="Senha">
                <Input.Password placeholder="senha" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prod_remetenteId" label="Remetente ID">
                <Input placeholder="ID do remetente cadastrado" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prod_cnpj" label="CNPJ">
                <Input placeholder="00.000.000/0000-00" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Homologação <EnvironmentBadge environment="sandbox" configured={config?.sandbox?.configured ?? false} /></Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sandbox_username" label="Usuário">
                <Input placeholder="usuário de homologação" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sandbox_password" label="Senha">
                <Input.Password placeholder="senha de homologação" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sandbox_remetenteId" label="Remetente ID">
                <Input placeholder="ID do remetente (homologação)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sandbox_cnpj" label="CNPJ">
                <Input placeholder="00.000.000/0000-00" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Financeiro</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="shippingCommissionPercent" label="Comissão de frete (%)">
                <InputNumber
                  min={0} max={100} step={0.1}
                  formatter={inputNumberFormatterBRL}
                  parser={inputNumberParserBRL}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveMutation.isPending}
            onClick={handleSave}
          >
            Salvar configuração
          </Button>
        </Form>
      ),
    },
    {
      key: 'test-auth',
      label: <span><ExperimentOutlined /> Teste Auth</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            Testa autenticação Basic Auth + uma chamada SOAP de cotação para verificar as credenciais.
          </Text>
          <Button
            type="primary"
            icon={<CloudOutlined />}
            loading={testLoading}
            onClick={() => handleTest('auth')}
          >
            Testar autenticação
          </Button>
          {testResult && testResult.type === 'auth' && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              message={testResult.success ? 'Autenticação OK' : 'Falha na autenticação'}
              description={
                <Space direction="vertical">
                  <Text>{testResult.message}</Text>
                  {testResult.latencyMs && <Text type="secondary">Latência: {testResult.latencyMs}ms</Text>}
                  {!testResult.success && testResult.error && (
                    <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(testResult.error, null, 2)}
                    </pre>
                  )}
                </Space>
              }
              showIcon
            />
          )}
        </Space>
      ),
    },
    {
      key: 'test-quote',
      label: <span><SearchOutlined /> Teste Cotação</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form form={quoteForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="cepOrigem" label="CEP Origem" rules={[{ required: true }]}>
                  <Input placeholder="01310-100" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="cepDestino" label="CEP Destino" rules={[{ required: true }]}>
                  <Input placeholder="20040-020" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="pesoKg" label="Peso (kg)" rules={[{ required: true }]}>
                  <InputNumber min={0.01} max={30} step={0.1} style={{ width: '100%' }} placeholder="1.0" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="comprimentoCm" label="Comprimento (cm)">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="20" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="larguraCm" label="Largura (cm)">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="15" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="alturaCm" label="Altura (cm)">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="10" />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={testLoading}
              onClick={async () => {
                const values = await quoteForm.validateFields();
                handleTest('quote', {
                  cepOrigem: values.cepOrigem,
                  cepDestino: values.cepDestino,
                  pesoKg: values.pesoKg,
                  comprimentoCm: values.comprimentoCm || 20,
                  larguraCm: values.larguraCm || 15,
                  alturaCm: values.alturaCm || 10,
                });
              }}
            >
              Cotar frete
            </Button>
          </Form>
          {testResult && testResult.type === 'quote' && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              description={
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(testResult.result, null, 2)}
                </pre>
              }
              showIcon
            />
          )}
        </Space>
      ),
    },
    {
      key: 'test-tracking',
      label: <span><SendOutlined /> Rastreamento</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form form={trackingForm} layout="vertical">
            <Form.Item name="awb" label="AWB" rules={[{ required: true }]}>
              <Input placeholder="Código AWB da Total Express" />
            </Form.Item>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={testLoading}
              onClick={async () => {
                const values = await trackingForm.validateFields();
                handleTest('tracking', { awb: values.awb });
              }}
            >
              Rastrear
            </Button>
          </Form>
          {testResult && testResult.type === 'tracking' && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              description={
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(testResult.result, null, 2)}
                </pre>
              }
              showIcon
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Total Express</Title>
            <Text type="secondary">Configuração da integração Total Express</Text>
          </div>
          <Space>
            {config?.configured
              ? <Badge status="success" text="Configurado" />
              : <Badge status="default" text="Não configurado" />}
            {config?.status && (
              <Tag color={config.status === 'ACTIVE' ? 'green' : 'red'}>
                {config.status}
              </Tag>
            )}
          </Space>
        </div>

        {config?.production?.passwordDecryptionFailed && (
          <Alert
            type="warning"
            icon={<WarningOutlined />}
            message="Falha ao descriptografar senha de produção — reconfigure as credenciais"
            showIcon
          />
        )}

        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
        </Card>
      </Space>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(admin)/admin/total-express/page.tsx app/(admin)/admin/total-express/loading.tsx app/(admin)/admin/total-express/TotalExpressClient.tsx
git commit -m "feat(total-express): add admin UI panel"
```

---

## Task 14: Final verification + push

- [ ] **Step 1: TypeScript check**

```bash
cd "/home/fernando-giovanetti/Área de trabalho/envio_legal" && pnpm tsc --noEmit 2>&1 | head -50
```

Expected: no errors in total-express files.

- [ ] **Step 2: Lint check**

```bash
cd "/home/fernando-giovanetti/Área de trabalho/envio_legal" && pnpm lint 2>&1 | grep -i "total-express\|error" | head -30
```

Expected: no lint errors.

- [ ] **Step 3: Verify admin nav renders Total Express**

Navigate to `/admin/total-express` in the browser. Confirm:
- Page loads with configuration form
- 4 tabs visible: Configuração, Teste Auth, Teste Cotação, Rastreamento
- No console errors

- [ ] **Step 4: Verify Total Express appears in eligibility service**

Run in Node REPL or check the server log on next quote request:
The log `[QUOTE][...] Eligibility evaluated` should now list `total-express` in the carriers array.

- [ ] **Step 5: Push**

```bash
git push
```

---

## SOAP Troubleshooting Note

If SOAP calls fail with namespace or parameter errors:

1. Fetch the actual WSDL to see parameter names:
   ```bash
   curl "https://edi.totalexpress.com.br/webservice_calculo_frete_v2.php?wsdl"
   ```

2. Adjust `TE_SOAP_NAMESPACE` and `TE_SOAP_ACTION_BASE` in `platform/integrations/total-express/constants.ts`

3. Adjust the XML tag names in `buildSoapEnvelope()` inside `platform/integrations/total-express/client.ts` — all SOAP parameter names are in that single function.

4. Check the raw response via the admin test panel (Teste Cotação) which logs the full API response.
