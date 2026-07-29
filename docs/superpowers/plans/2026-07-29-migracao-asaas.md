# Migração do gateway de pagamento para o Asaas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a integração Pagar.me pelo Asaas, suportando PIX, cartão de crédito, cartões salvos e boleto em todos os fluxos de pagamento.

**Architecture:** Novo módulo `platform/integrations/asaas/` espelhando a estrutura do módulo Pagar.me atual, porém com separação explícita entre camada de API pura (sem banco) e camada de rastreamento (com banco) — o módulo antigo misturava as duas em `payments.ts`. As tabelas de pagamento já são genéricas e não mudam; apenas o registro do gateway passa a ter `slug: 'asaas'`. Ao final, o módulo `pagarme` e todas as suas referências são removidos.

**Tech Stack:** Next.js (App Router), TypeScript, Prisma + PostgreSQL, BullMQ (workers), Zod, `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-07-29-migracao-asaas-design.md`

## Global Constraints

- **Valores monetários trafegam em centavos (`Int`) dentro do sistema.** O Asaas usa reais decimais. A conversão acontece **exclusivamente** em `platform/integrations/asaas/money.ts`. Nenhum outro arquivo pode multiplicar ou dividir por 100.
- **Base URL sandbox:** `https://api-sandbox.asaas.com` — **produção:** `https://api.asaas.com`. Todos os caminhos de endpoint começam com `/v3`.
- **Autenticação:** header `access_token` com a chave da conta. O Asaas tem **uma única chave** (não existe par público/secreto como no Pagar.me).
- **Webhook:** header `asaas-access-token`, valor definido por nós ao registrar o webhook no painel. Entre 32 e 255 caracteres, sem espaços. Entrega é *at-least-once* — eventos duplicados são esperados e devem ser absorvidos pela restrição de unicidade já existente em `payment_webhooks`.
- **`remoteIp` é obrigatório** ao tokenizar cartão e ao cobrar cartão. Deve ser o IP do cliente final (`x-forwarded-for`), nunca o IP do servidor.
- **Liberação do serviço:** status `CONFIRMED` do Asaas já libera o pedido. Não esperar `RECEIVED`.
- **Testes:** `node:test` com `node:assert/strict`, arquivos em `tests/unit/**/*.test.ts`. Rodar com `pnpm test:unit`. Serviços recebem dependências por injeção (ver `tests/unit/wallet/debit.service.test.ts` como referência de estilo).
- **Segredos nunca em código.** A chave fica em `PaymentCredential.accessToken` (criptografada via `encryption.service`) com fallback para a env `ASAAS_API_KEY`.
- **Idioma:** mensagens de erro voltadas ao usuário em português; nomes de código em inglês, seguindo o padrão do repositório.

---

## Estrutura de Arquivos

**Módulo novo — `platform/integrations/asaas/`:**

| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Interfaces da API do Asaas + classe `AsaasApiError` |
| `money.ts` | Conversão centavos ⇄ reais (único lugar autorizado) |
| `status.ts` | Mapeamento de status e meio de pagamento Asaas → enums do Prisma |
| `config.ts` | Busca da credencial (banco + fallback env), cache de 5 min |
| `client.ts` | `asaasRequest` — fetch autenticado com tratamento de erro |
| `customers.ts` | Criar/buscar cliente no Asaas |
| `cards.ts` | Tokenização de cartão |
| `charges.ts` | Cobranças: criar, buscar, estornar, QR Code PIX, linha digitável |
| `tracking.ts` | Camada com banco: cria cobrança + registra `PaymentTransaction` |
| `release.ts` | Regra única de "pode liberar o serviço?" — evita etiqueta com boleto não pago |
| `webhooks.ts` | Validação do token e extração do evento |
| `pix-monitor.ts` | Varredura de cobranças pendentes (PIX e boleto) |
| `index.ts` | Exportações públicas do módulo |

**Removidos ao final:** `platform/integrations/pagarme/` (10 arquivos), `app/api/payments/pagarme/`, `app/api/webhooks/pagarme/`, `app/api/admin/integrations/pagarme/`, `app/(admin)/admin/pagarme/`, `workers/webhook/pagarme.worker.ts`, `modules/payments/ui/utils/tokenizeCard.ts`.

---

## Fase 1 — Núcleo da integração

### Task 1: Fundação — tipos, conversão monetária e mapeamento de status

**Files:**
- Create: `platform/integrations/asaas/types.ts`
- Create: `platform/integrations/asaas/money.ts`
- Create: `platform/integrations/asaas/status.ts`
- Test: `tests/unit/asaas/money.test.ts`
- Test: `tests/unit/asaas/status.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: `toCents(reais: number): number`, `toReais(cents: number): number`, `mapAsaasStatus(status: string): TransactionStatus`, `mapBillingTypeToMethod(billingType: string): PaymentMethod`, `mapMethodToBillingType(method: 'pix'|'credit_card'|'boleto'): AsaasBillingType`, tipos `AsaasCharge`, `AsaasCustomer`, `AsaasConfig`, `AsaasPixQrCode`, `AsaasBoletoIdentification`, `AsaasWebhookPayload`, classe `AsaasApiError`

- [ ] **Step 1: Escrever o teste de conversão monetária que falha**

Criar `tests/unit/asaas/money.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, toReais } from '@/platform/integrations/asaas/money';

describe('money', () => {
  it('converte centavos para reais com duas casas', () => {
    assert.equal(toReais(4990), 49.9);
    assert.equal(toReais(8990), 89.9);
    assert.equal(toReais(100), 1);
    assert.equal(toReais(1), 0.01);
    assert.equal(toReais(0), 0);
  });

  it('converte reais para centavos sem erro de ponto flutuante', () => {
    // 49.90 * 100 === 4990.000000000001 em ponto flutuante
    assert.equal(toCents(49.9), 4990);
    assert.equal(toCents(89.9), 8990);
    assert.equal(toCents(0.07), 7);
    assert.equal(toCents(1.005), 101);
    assert.equal(toCents(146.43), 14643);
  });

  it('faz round-trip sem perder valor', () => {
    for (const cents of [1, 7, 99, 4990, 14990, 999999]) {
      assert.equal(toCents(toReais(cents)), cents);
    }
  });

  it('rejeita valores não finitos', () => {
    assert.throws(() => toCents(Number.NaN), /valor monetário inválido/i);
    assert.throws(() => toReais(Number.POSITIVE_INFINITY), /valor monetário inválido/i);
  });

  it('rejeita centavos fracionados', () => {
    assert.throws(() => toReais(10.5), /centavos deve ser inteiro/i);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/money.test.ts`
Expected: FAIL — `Cannot find module '@/platform/integrations/asaas/money'`

- [ ] **Step 3: Implementar a conversão monetária**

Criar `platform/integrations/asaas/money.ts`:

```ts
/**
 * Conversão monetária entre o sistema (centavos, Int) e o Asaas (reais, decimal).
 *
 * ESTE É O ÚNICO ARQUIVO AUTORIZADO A MULTIPLICAR OU DIVIDIR VALORES POR 100.
 * Erro de arredondamento em dinheiro só aparece no fechamento contábil — manter
 * a conversão centralizada é o que torna esse bug impossível de espalhar.
 */

function assertFinite(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Valor monetário inválido: ${value}`);
  }
}

/** Converte centavos inteiros para reais com 2 casas decimais. Ex.: 4990 -> 49.9 */
export function toReais(cents: number): number {
  assertFinite(cents);
  if (!Number.isInteger(cents)) {
    throw new Error(`Valor em centavos deve ser inteiro: ${cents}`);
  }
  return Number((cents / 100).toFixed(2));
}

/** Converte reais para centavos inteiros. Ex.: 49.9 -> 4990 */
export function toCents(reais: number): number {
  assertFinite(reais);
  return Math.round(reais * 100);
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/money.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 5: Escrever o teste de mapeamento de status que falha**

Criar `tests/unit/asaas/status.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAsaasStatus,
  mapBillingTypeToMethod,
  mapMethodToBillingType,
} from '@/platform/integrations/asaas/status';

describe('mapAsaasStatus', () => {
  it('mapeia CONFIRMED para CAPTURED (libera o serviço)', () => {
    assert.equal(mapAsaasStatus('CONFIRMED'), 'CAPTURED');
  });

  it('mapeia RECEIVED para PAID', () => {
    assert.equal(mapAsaasStatus('RECEIVED'), 'PAID');
    assert.equal(mapAsaasStatus('RECEIVED_IN_CASH'), 'PAID');
  });

  it('mapeia estados pendentes', () => {
    assert.equal(mapAsaasStatus('PENDING'), 'PENDING');
    assert.equal(mapAsaasStatus('AWAITING_RISK_ANALYSIS'), 'PENDING');
  });

  it('mapeia vencido e cancelado para CANCELED', () => {
    assert.equal(mapAsaasStatus('OVERDUE'), 'CANCELED');
    assert.equal(mapAsaasStatus('DELETED'), 'CANCELED');
  });

  it('mapeia estornos e contestações', () => {
    assert.equal(mapAsaasStatus('REFUNDED'), 'REFUNDED');
    assert.equal(mapAsaasStatus('REFUND_REQUESTED'), 'REFUNDED');
    assert.equal(mapAsaasStatus('CHARGEBACK_REQUESTED'), 'CHARGEBACK');
    assert.equal(mapAsaasStatus('CHARGEBACK_DISPUTE'), 'CHARGEBACK');
  });

  it('mapeia recusa de cartão para FAILED', () => {
    assert.equal(mapAsaasStatus('CREDIT_CARD_CAPTURE_REFUSED'), 'FAILED');
  });

  it('usa PENDING como padrão para status desconhecido', () => {
    assert.equal(mapAsaasStatus('ALGO_NOVO_NA_API'), 'PENDING');
  });
});

describe('mapeamento de meio de pagamento', () => {
  it('converte billingType do Asaas para o enum interno', () => {
    assert.equal(mapBillingTypeToMethod('PIX'), 'PIX');
    assert.equal(mapBillingTypeToMethod('CREDIT_CARD'), 'CREDIT_CARD');
    assert.equal(mapBillingTypeToMethod('BOLETO'), 'BOLETO');
    assert.equal(mapBillingTypeToMethod('DEBIT_CARD'), 'DEBIT_CARD');
  });

  it('converte o método da nossa API para billingType do Asaas', () => {
    assert.equal(mapMethodToBillingType('pix'), 'PIX');
    assert.equal(mapMethodToBillingType('credit_card'), 'CREDIT_CARD');
    assert.equal(mapMethodToBillingType('boleto'), 'BOLETO');
  });
});
```

- [ ] **Step 6: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/status.test.ts`
Expected: FAIL — módulo `status` não encontrado

- [ ] **Step 7: Implementar tipos e mapeamento de status**

Criar `platform/integrations/asaas/types.ts`:

```ts
// platform/integrations/asaas/types.ts

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'DEBIT_CARD' | 'UNDEFINED';

export interface AsaasConfig {
  apiKey: string;       // $aact_hmlg_... (sandbox) ou $aact_prod_... (produção)
  baseUrl: string;      // https://api-sandbox.asaas.com ou https://api.asaas.com
  webhookToken?: string; // valor esperado no header asaas-access-token
  sandboxMode: boolean;
}

export interface AsaasCustomer {
  id: string;           // cus_000008517065
  name: string;
  email?: string;
  cpfCnpj?: string;
  mobilePhone?: string;
}

export interface AsaasCreditCardInfo {
  creditCardNumber: string;  // últimos 4 dígitos
  creditCardBrand: string;   // MASTERCARD, VISA...
  creditCardToken: string;
}

export interface AsaasCharge {
  id: string;                 // pay_3v9st3v3mm884zkc
  customer: string;
  status: string;             // PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED...
  billingType: AsaasBillingType;
  value: number;              // reais
  netValue?: number;          // reais, já descontada a taxa
  dueDate: string;            // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;       // PDF do boleto
  installment?: string;       // id do parcelamento, quando parcelado
  installmentCount?: number;
  creditCard?: AsaasCreditCardInfo;
  confirmedDate?: string;
  paymentDate?: string;
  dateCreated?: string;
}

export interface AsaasPixQrCode {
  success: boolean;
  encodedImage: string;   // PNG em base64
  payload: string;        // copia-e-cola
  expirationDate: string;
}

export interface AsaasBoletoIdentification {
  identificationField: string; // linha digitável
  nossoNumero: string;
  barCode: string;
}

export interface AsaasTokenizeResponse {
  creditCardNumber: string;
  creditCardBrand: string;
  creditCardToken: string;
}

export interface AsaasWebhookPayload {
  id: string;             // evt_...
  event: string;          // PAYMENT_CONFIRMED | PAYMENT_RECEIVED | ...
  dateCreated: string;
  payment: AsaasCharge;
}

export interface AsaasListResponse<T> {
  object: 'list';
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
}

export class AsaasApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AsaasApiError';
  }
}
```

Criar `platform/integrations/asaas/status.ts`:

```ts
import type { TransactionStatus, PaymentMethod } from '@prisma/client';
import type { AsaasBillingType } from './types';

/**
 * Mapeia o status de uma cobrança do Asaas para o enum interno.
 *
 * CONFIRMED -> CAPTURED é intencional: no cartão, CONFIRMED significa compra
 * aprovada (segundos) enquanto RECEIVED significa dinheiro liquidado (~30 dias).
 * O serviço é liberado na aprovação, conforme decidido na spec.
 */
export function mapAsaasStatus(status: string): TransactionStatus {
  const map: Record<string, TransactionStatus> = {
    PENDING: 'PENDING',
    AWAITING_RISK_ANALYSIS: 'PENDING',
    AWAITING_CHARGEBACK_REVERSAL: 'PENDING',
    CONFIRMED: 'CAPTURED',
    RECEIVED: 'PAID',
    RECEIVED_IN_CASH: 'PAID',
    REFUNDED: 'REFUNDED',
    REFUND_REQUESTED: 'REFUNDED',
    REFUND_IN_PROGRESS: 'REFUNDED',
    PARTIALLY_REFUNDED: 'REFUNDED',
    CHARGEBACK_REQUESTED: 'CHARGEBACK',
    CHARGEBACK_DISPUTE: 'CHARGEBACK',
    CREDIT_CARD_CAPTURE_REFUSED: 'FAILED',
    OVERDUE: 'CANCELED',
    DELETED: 'CANCELED',
  };
  return map[status] ?? 'PENDING';
}

export function mapBillingTypeToMethod(billingType: string): PaymentMethod {
  const map: Record<string, PaymentMethod> = {
    PIX: 'PIX',
    CREDIT_CARD: 'CREDIT_CARD',
    DEBIT_CARD: 'DEBIT_CARD',
    BOLETO: 'BOLETO',
  };
  return map[billingType] ?? 'CREDIT_CARD';
}

export function mapMethodToBillingType(
  method: 'pix' | 'credit_card' | 'boleto',
): AsaasBillingType {
  const map: Record<string, AsaasBillingType> = {
    pix: 'PIX',
    credit_card: 'CREDIT_CARD',
    boleto: 'BOLETO',
  };
  return map[method];
}
```

- [ ] **Step 8: Rodar os dois testes para confirmar que passam**

Run: `pnpm test:unit -- tests/unit/asaas/money.test.ts tests/unit/asaas/status.test.ts`
Expected: PASS — 12 testes

- [ ] **Step 9: Commit**

```bash
git add platform/integrations/asaas/types.ts platform/integrations/asaas/money.ts platform/integrations/asaas/status.ts tests/unit/asaas/
git commit -m "feat(asaas): tipos, conversão monetária e mapeamento de status"
```

---

### Task 2: Configuração e cliente HTTP

**Files:**
- Create: `platform/integrations/asaas/config.ts`
- Create: `platform/integrations/asaas/client.ts`
- Test: `tests/unit/asaas/client.test.ts`

**Interfaces:**
- Consumes: `AsaasConfig`, `AsaasApiError` (Task 1)
- Produces: `getAsaasConfig(): Promise<AsaasConfig | null>`, `invalidateAsaasConfigCache(): void`, `isAsaasConfigured(): Promise<boolean>`, `asaasRequest<T>(path: string, options?: RequestInit, deps?: AsaasRequestDeps): Promise<T>`, tipo `AsaasRequestDeps = { getConfig?: () => Promise<AsaasConfig | null>; fetchImpl?: typeof fetch }`

- [ ] **Step 1: Escrever o teste do cliente que falha**

Criar `tests/unit/asaas/client.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { asaasRequest } from '@/platform/integrations/asaas/client';
import { AsaasApiError } from '@/platform/integrations/asaas/types';

const config = {
  apiKey: '$aact_hmlg_chave_de_teste',
  baseUrl: 'https://api-sandbox.asaas.com',
  sandboxMode: true,
};

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('asaasRequest', () => {
  it('envia a chave no header access_token', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'cus_1' });

    await asaasRequest('/v3/customers', {}, {
      getConfig: async () => config,
      fetchImpl: impl,
    });

    assert.equal(calls[0].url, 'https://api-sandbox.asaas.com/v3/customers');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.access_token, '$aact_hmlg_chave_de_teste');
    assert.equal(headers['Content-Type'], 'application/json');
  });

  it('lança NOT_CONFIGURED quando não há credencial', async () => {
    const { impl } = fakeFetch(200, {});
    await assert.rejects(
      () => asaasRequest('/v3/customers', {}, { getConfig: async () => null, fetchImpl: impl }),
      (err: unknown) => err instanceof AsaasApiError && err.code === 'NOT_CONFIGURED',
    );
  });

  it('extrai a descrição do erro do corpo da resposta', async () => {
    const { impl } = fakeFetch(400, {
      errors: [{ code: 'invalid_mobilePhone', description: 'O celular informado é inválido.' }],
    });

    await assert.rejects(
      () => asaasRequest('/v3/customers', {}, { getConfig: async () => config, fetchImpl: impl }),
      (err: unknown) =>
        err instanceof AsaasApiError &&
        err.statusCode === 400 &&
        err.message === 'O celular informado é inválido.' &&
        err.code === 'invalid_mobilePhone',
    );
  });

  it('usa mensagem genérica quando o corpo do erro não é legível', async () => {
    const impl = (async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    })) as unknown as typeof fetch;

    await assert.rejects(
      () => asaasRequest('/v3/customers', {}, { getConfig: async () => config, fetchImpl: impl }),
      (err: unknown) => err instanceof AsaasApiError && err.statusCode === 502,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/client.test.ts`
Expected: FAIL — módulo `client` não encontrado

- [ ] **Step 3: Implementar a configuração**

Criar `platform/integrations/asaas/config.ts`:

```ts
/**
 * Configuração do Asaas.
 *
 * Prioridade: credencial ativa no banco (criptografada) > variáveis de ambiente.
 * Diferente do Pagar.me, o Asaas usa uma única chave — não há par público/secreto.
 */

import { prisma } from '@/platform/db/db';
import { decrypt } from '@/platform/integrations/shared/encryption.service';
import type { AsaasConfig } from './types';

const ASAAS_SLUG = 'asaas';
const CACHE_TTL = 5 * 60 * 1000;

let configCache: { config: AsaasConfig | null; timestamp: number } | null = null;

export async function getAsaasConfig(): Promise<AsaasConfig | null> {
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL) {
    return configCache.config;
  }

  try {
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: ASAAS_SLUG, status: 'ACTIVE' },
      include: {
        credentials: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (gateway && gateway.credentials.length > 0) {
      const cred = gateway.credentials[0];
      const apiKey = cred.accessToken ? decrypt(cred.accessToken) : '';

      if (!apiKey) {
        console.warn('[ASAAS_CONFIG] Credencial sem chave de API no banco');
        return cacheAndReturn(getFallbackConfig());
      }

      return cacheAndReturn({
        apiKey,
        baseUrl: gateway.baseUrl || 'https://api-sandbox.asaas.com',
        webhookToken: cred.clientSecret ? decrypt(cred.clientSecret) : process.env.ASAAS_WEBHOOK_TOKEN,
        sandboxMode: gateway.environment === 'SANDBOX',
      });
    }

    return cacheAndReturn(getFallbackConfig());
  } catch (error) {
    console.error('[ASAAS_CONFIG] Erro ao buscar configuração:', error);
    return cacheAndReturn(getFallbackConfig());
  }
}

function cacheAndReturn(config: AsaasConfig | null): AsaasConfig | null {
  configCache = { config, timestamp: Date.now() };
  return config;
}

function getFallbackConfig(): AsaasConfig | null {
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com';

  if (!apiKey) {
    console.warn(
      '[ASAAS_CONFIG] Asaas não configurado. Configure via admin ou defina ASAAS_API_KEY',
    );
    return null;
  }

  return {
    apiKey,
    baseUrl,
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
    sandboxMode: baseUrl.includes('sandbox'),
  };
}

/** Deve ser chamado após atualizar credenciais no admin. */
export function invalidateAsaasConfigCache(): void {
  configCache = null;
}

export async function isAsaasConfigured(): Promise<boolean> {
  return (await getAsaasConfig()) !== null;
}
```

- [ ] **Step 4: Implementar o cliente HTTP**

Criar `platform/integrations/asaas/client.ts`:

```ts
import 'server-only';
import { getAsaasConfig } from './config';
import { AsaasApiError } from './types';
import type { AsaasConfig } from './types';

export interface AsaasRequestDeps {
  getConfig?: () => Promise<AsaasConfig | null>;
  fetchImpl?: typeof fetch;
}

interface AsaasErrorBody {
  errors?: Array<{ code?: string; description?: string }>;
}

/**
 * Requisição autenticada à API do Asaas.
 *
 * O Asaas devolve erros no formato { errors: [{ code, description }] } — bem mais
 * descritivo que o do gateway anterior, então preservamos code e description.
 *
 * @throws AsaasApiError quando não configurado ou quando a API responde fora da faixa 2xx
 */
export async function asaasRequest<T>(
  path: string,
  options: RequestInit = {},
  deps: AsaasRequestDeps = {},
): Promise<T> {
  const getConfig = deps.getConfig ?? getAsaasConfig;
  const doFetch = deps.fetchImpl ?? fetch;

  const config = await getConfig();
  if (!config) {
    throw new AsaasApiError('NOT_CONFIGURED', 'Asaas não configurado');
  }

  const res = await doFetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: config.apiKey,
      'User-Agent': 'envio-legal/1.0',
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!res.ok) {
    let code = 'API_ERROR';
    let message = `Asaas error ${res.status}`;
    try {
      const body = (await res.json()) as AsaasErrorBody;
      const first = body.errors?.[0];
      if (first?.description) message = first.description;
      if (first?.code) code = first.code;
    } catch {
      /* corpo não legível — mantém a mensagem genérica */
    }
    throw new AsaasApiError(code, message, res.status);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/client.test.ts`
Expected: PASS — 4 testes

- [ ] **Step 6: Commit**

```bash
git add platform/integrations/asaas/config.ts platform/integrations/asaas/client.ts tests/unit/asaas/client.test.ts
git commit -m "feat(asaas): configuração com fallback de env e cliente HTTP autenticado"
```

---

### Task 3: Clientes (customers)

**Files:**
- Create: `platform/integrations/asaas/customers.ts`
- Test: `tests/unit/asaas/customers.test.ts`

**Interfaces:**
- Consumes: `asaasRequest` (Task 2), `AsaasCustomer`, `AsaasListResponse` (Task 1)
- Produces: `getOrCreateCustomer(input: GetOrCreateCustomerInput, deps?: CustomersDeps): Promise<AsaasCustomer>`, `getCustomerById(id: string): Promise<AsaasCustomer>`, tipos `GetOrCreateCustomerInput = { name: string; email: string; document?: string; phone?: string }` e `CustomersDeps = { request?: typeof asaasRequest }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/asaas/customers.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateCustomer } from '@/platform/integrations/asaas/customers';

function fakeRequest(responses: Record<string, unknown>) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const request = async (path: string, options: RequestInit = {}) => {
    calls.push({
      path,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    });
    const key = Object.keys(responses).find((k) => path.startsWith(k));
    return responses[key ?? ''] ?? {};
  };
  return { request: request as never, calls };
}

describe('getOrCreateCustomer', () => {
  it('reaproveita o cliente existente quando o CPF já está cadastrado', async () => {
    const { request, calls } = fakeRequest({
      '/v3/customers?cpfCnpj': { object: 'list', totalCount: 1, data: [{ id: 'cus_existente' }] },
    });

    const customer = await getOrCreateCustomer(
      { name: 'Maria', email: 'maria@teste.com', document: '249.715.637-92' },
      { request },
    );

    assert.equal(customer.id, 'cus_existente');
    assert.equal(calls.length, 1, 'não deve criar cliente quando já existe');
  });

  it('cria o cliente quando não existe, limpando a pontuação do CPF', async () => {
    const { request, calls } = fakeRequest({
      '/v3/customers?cpfCnpj': { object: 'list', totalCount: 0, data: [] },
      '/v3/customers': { id: 'cus_novo', name: 'Maria' },
    });

    const customer = await getOrCreateCustomer(
      { name: 'Maria', email: 'maria@teste.com', document: '249.715.637-92', phone: '(47) 98877-6655' },
      { request },
    );

    assert.equal(customer.id, 'cus_novo');
    const create = calls[1];
    assert.equal(create.path, '/v3/customers');
    assert.deepEqual(create.body, {
      name: 'Maria',
      email: 'maria@teste.com',
      cpfCnpj: '24971563792',
      mobilePhone: '47988776655',
    });
  });

  it('cria o cliente sem consultar quando não há documento', async () => {
    const { request, calls } = fakeRequest({ '/v3/customers': { id: 'cus_sem_doc' } });

    const customer = await getOrCreateCustomer({ name: 'João', email: 'joao@teste.com' }, { request });

    assert.equal(customer.id, 'cus_sem_doc');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, { name: 'João', email: 'joao@teste.com' });
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/customers.test.ts`
Expected: FAIL — módulo `customers` não encontrado

- [ ] **Step 3: Implementar**

Criar `platform/integrations/asaas/customers.ts`:

```ts
import 'server-only';
import { asaasRequest } from './client';
import type { AsaasCustomer, AsaasListResponse } from './types';

export interface GetOrCreateCustomerInput {
  name: string;
  email: string;
  document?: string; // CPF/CNPJ com ou sem pontuação
  phone?: string;
}

export interface CustomersDeps {
  request?: typeof asaasRequest;
}

/**
 * Busca o cliente pelo CPF/CNPJ e cria apenas se não existir.
 *
 * Diferente do Pagar.me, o POST /v3/customers do Asaas NÃO faz upsert por e-mail:
 * chamar duas vezes cria dois clientes. Por isso a consulta prévia é obrigatória.
 */
export async function getOrCreateCustomer(
  input: GetOrCreateCustomerInput,
  deps: CustomersDeps = {},
): Promise<AsaasCustomer> {
  const request = deps.request ?? asaasRequest;
  const document = input.document?.replace(/\D/g, '');

  if (document) {
    const existing = await request<AsaasListResponse<AsaasCustomer>>(
      `/v3/customers?cpfCnpj=${document}&limit=1`,
    );
    if (existing.data?.length > 0) {
      return existing.data[0];
    }
  }

  const body: Record<string, unknown> = { name: input.name, email: input.email };
  if (document) body.cpfCnpj = document;

  const phone = input.phone?.replace(/\D/g, '');
  if (phone && phone.length >= 10) body.mobilePhone = phone;

  return request<AsaasCustomer>('/v3/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCustomerById(customerId: string): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(`/v3/customers/${customerId}`);
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/customers.test.ts`
Expected: PASS — 3 testes

- [ ] **Step 5: Commit**

```bash
git add platform/integrations/asaas/customers.ts tests/unit/asaas/customers.test.ts
git commit -m "feat(asaas): criação idempotente de clientes por CPF/CNPJ"
```

---

### Task 4: Cobranças — PIX, cartão e boleto

**Files:**
- Create: `platform/integrations/asaas/charges.ts`
- Test: `tests/unit/asaas/charges.test.ts`

**Interfaces:**
- Consumes: `asaasRequest` (Task 2), `toReais`/`toCents` (Task 1), `mapMethodToBillingType` (Task 1)
- Produces: `createCharge(input: CreateChargeInput, deps?: ChargesDeps): Promise<AsaasCharge>`, `getCharge(id: string): Promise<AsaasCharge>`, `refundCharge(id: string, amountCents?: number): Promise<AsaasCharge>`, `getPixQrCode(id: string): Promise<AsaasPixQrCode>`, `getBoletoIdentification(id: string): Promise<AsaasBoletoIdentification>`, tipo `CreateChargeInput`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/asaas/charges.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCharge, refundCharge } from '@/platform/integrations/asaas/charges';

function fakeRequest(response: unknown = { id: 'pay_1', status: 'PENDING' }) {
  const calls: Array<{ path: string; method?: string; body: any }> = [];
  const request = async (path: string, options: RequestInit = {}) => {
    calls.push({
      path,
      method: options.method,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    });
    return response;
  };
  return { request: request as never, calls };
}

const base = {
  customerId: 'cus_1',
  amountCents: 4990,
  description: 'Envio',
  referenceId: 'el_abc',
  dueDate: '2026-08-05',
};

describe('createCharge', () => {
  it('envia valor em reais, não em centavos', async () => {
    const { request, calls } = fakeRequest();
    await createCharge({ ...base, paymentMethod: 'pix' }, { request });

    assert.equal(calls[0].path, '/v3/payments');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.value, 49.9);
    assert.equal(calls[0].body.billingType, 'PIX');
    assert.equal(calls[0].body.externalReference, 'el_abc');
  });

  it('gera boleto com o billingType correto', async () => {
    const { request, calls } = fakeRequest();
    await createCharge({ ...base, paymentMethod: 'boleto' }, { request });

    assert.equal(calls[0].body.billingType, 'BOLETO');
    assert.equal(calls[0].body.creditCardToken, undefined);
  });

  it('cobra cartão salvo enviando token e IP do cliente', async () => {
    const { request, calls } = fakeRequest();
    await createCharge(
      { ...base, paymentMethod: 'credit_card', cardToken: 'tok_1', remoteIp: '203.0.113.7' },
      { request },
    );

    assert.equal(calls[0].body.billingType, 'CREDIT_CARD');
    assert.equal(calls[0].body.creditCardToken, 'tok_1');
    assert.equal(calls[0].body.remoteIp, '203.0.113.7');
  });

  it('parcela usando totalValue em vez de value', async () => {
    const { request, calls } = fakeRequest();
    await createCharge(
      {
        ...base,
        amountCents: 30000,
        paymentMethod: 'credit_card',
        cardToken: 'tok_1',
        remoteIp: '203.0.113.7',
        installments: 3,
      },
      { request },
    );

    assert.equal(calls[0].body.installmentCount, 3);
    assert.equal(calls[0].body.totalValue, 300);
    assert.equal(calls[0].body.value, undefined, 'value e totalValue são mutuamente exclusivos');
  });

  it('recusa cartão sem token', async () => {
    const { request } = fakeRequest();
    await assert.rejects(
      () => createCharge({ ...base, paymentMethod: 'credit_card', remoteIp: '203.0.113.7' }, { request }),
      /cartão exige creditCardToken/i,
    );
  });

  it('recusa cartão sem IP do cliente', async () => {
    const { request } = fakeRequest();
    await assert.rejects(
      () => createCharge({ ...base, paymentMethod: 'credit_card', cardToken: 'tok_1' }, { request }),
      /remoteIp é obrigatório/i,
    );
  });
});

describe('refundCharge', () => {
  it('estorna o valor total quando não informado', async () => {
    const { request, calls } = fakeRequest({ id: 'pay_1', status: 'REFUNDED' });
    await refundCharge('pay_1', undefined, { request });

    assert.equal(calls[0].path, '/v3/payments/pay_1/refund');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, {});
  });

  it('estorna parcialmente convertendo centavos para reais', async () => {
    const { request, calls } = fakeRequest({ id: 'pay_1', status: 'PARTIALLY_REFUNDED' });
    await refundCharge('pay_1', 1500, { request });

    assert.equal(calls[0].body.value, 15);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/charges.test.ts`
Expected: FAIL — módulo `charges` não encontrado

- [ ] **Step 3: Implementar**

Criar `platform/integrations/asaas/charges.ts`:

```ts
import 'server-only';
import { asaasRequest } from './client';
import { toReais } from './money';
import { mapMethodToBillingType } from './status';
import type { AsaasCharge, AsaasPixQrCode, AsaasBoletoIdentification } from './types';

export interface CreateChargeInput {
  customerId: string;
  amountCents: number;
  description: string;
  referenceId: string;
  dueDate: string;                 // YYYY-MM-DD
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
  cardToken?: string;
  remoteIp?: string;               // IP do cliente final — obrigatório para cartão
  installments?: number;
}

export interface ChargesDeps {
  request?: typeof asaasRequest;
}

/**
 * Cria uma cobrança no Asaas.
 *
 * Diferente do modelo de "order" do gateway anterior, toda cobrança do Asaas tem
 * vencimento (dueDate). Para compra à vista, quem chama passa a data de hoje.
 */
export async function createCharge(
  input: CreateChargeInput,
  deps: ChargesDeps = {},
): Promise<AsaasCharge> {
  const request = deps.request ?? asaasRequest;

  const body: Record<string, unknown> = {
    customer: input.customerId,
    billingType: mapMethodToBillingType(input.paymentMethod),
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.referenceId,
  };

  if (input.paymentMethod === 'credit_card') {
    if (!input.cardToken) {
      throw new Error('createCharge: cartão exige creditCardToken');
    }
    if (!input.remoteIp) {
      throw new Error('createCharge: remoteIp é obrigatório para cartão');
    }
    body.creditCardToken = input.cardToken;
    body.remoteIp = input.remoteIp;
  }

  // O Asaas rejeita value e totalValue juntos: parcelado usa totalValue.
  if (input.installments && input.installments > 1) {
    body.installmentCount = input.installments;
    body.totalValue = toReais(input.amountCents);
  } else {
    body.value = toReais(input.amountCents);
  }

  return request<AsaasCharge>('/v3/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCharge(chargeId: string): Promise<AsaasCharge> {
  return asaasRequest<AsaasCharge>(`/v3/payments/${chargeId}`);
}

/** Estorna a cobrança. Sem amountCents, estorna o valor integral. */
export async function refundCharge(
  chargeId: string,
  amountCents?: number,
  deps: ChargesDeps = {},
): Promise<AsaasCharge> {
  const request = deps.request ?? asaasRequest;
  const body = amountCents != null ? { value: toReais(amountCents) } : {};

  return request<AsaasCharge>(`/v3/payments/${chargeId}/refund`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPixQrCode(chargeId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/v3/payments/${chargeId}/pixQrCode`);
}

export async function getBoletoIdentification(
  chargeId: string,
): Promise<AsaasBoletoIdentification> {
  return asaasRequest<AsaasBoletoIdentification>(
    `/v3/payments/${chargeId}/identificationField`,
  );
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/charges.test.ts`
Expected: PASS — 8 testes

- [ ] **Step 5: Commit**

```bash
git add platform/integrations/asaas/charges.ts tests/unit/asaas/charges.test.ts
git commit -m "feat(asaas): cobranças PIX, cartão e boleto com estorno e parcelamento"
```

---

### Task 5: Tokenização de cartão

**Files:**
- Create: `platform/integrations/asaas/cards.ts`
- Test: `tests/unit/asaas/cards.test.ts`

**Interfaces:**
- Consumes: `asaasRequest` (Task 2), `AsaasTokenizeResponse` (Task 1)
- Produces: `tokenizeCard(input: TokenizeCardInput, deps?: CardsDeps): Promise<AsaasTokenizeResponse>`, tipo `TokenizeCardInput`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/asaas/cards.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeCard } from '@/platform/integrations/asaas/cards';

function fakeRequest() {
  const calls: Array<{ path: string; body: any }> = [];
  const request = async (path: string, options: RequestInit = {}) => {
    calls.push({ path, body: JSON.parse(options.body as string) });
    return {
      creditCardNumber: '8829',
      creditCardBrand: 'MASTERCARD',
      creditCardToken: 'tok_abc',
    };
  };
  return { request: request as never, calls };
}

const input = {
  customerId: 'cus_1',
  holderName: 'CLIENTE TESTE',
  number: '5162 3062 1937 8829',
  expiryMonth: 12,
  expiryYear: 2030,
  ccv: '318',
  remoteIp: '203.0.113.7',
  holder: {
    name: 'Cliente Teste',
    email: 'teste@enviolegal.com.br',
    cpfCnpj: '249.715.637-92',
    postalCode: '89223-005',
    addressNumber: '277',
    phone: '(47) 3801-0919',
  },
};

describe('tokenizeCard', () => {
  it('envia o cartão sem pontuação e devolve o token', async () => {
    const { request, calls } = fakeRequest();
    const result = await tokenizeCard(input, { request });

    assert.equal(result.creditCardToken, 'tok_abc');
    assert.equal(result.creditCardNumber, '8829');
    assert.equal(calls[0].path, '/v3/creditCard/tokenizeCreditCard');
    assert.equal(calls[0].body.creditCard.number, '5162306219378829');
    assert.equal(calls[0].body.creditCard.expiryMonth, '12');
    assert.equal(calls[0].body.creditCard.expiryYear, '2030');
    assert.equal(calls[0].body.creditCardHolderInfo.cpfCnpj, '24971563792');
    assert.equal(calls[0].body.creditCardHolderInfo.postalCode, '89223005');
    assert.equal(calls[0].body.remoteIp, '203.0.113.7');
  });

  it('exige o IP do cliente', async () => {
    const { request } = fakeRequest();
    await assert.rejects(
      () => tokenizeCard({ ...input, remoteIp: '' }, { request }),
      /remoteIp é obrigatório/i,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/cards.test.ts`
Expected: FAIL — módulo `cards` não encontrado

- [ ] **Step 3: Implementar**

Criar `platform/integrations/asaas/cards.ts`:

```ts
import 'server-only';
import { asaasRequest } from './client';
import type { AsaasTokenizeResponse } from './types';

export interface TokenizeCardInput {
  customerId: string;
  holderName: string;
  number: string;
  expiryMonth: number;
  expiryYear: number;
  ccv: string;
  remoteIp: string;
  holder: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}

export interface CardsDeps {
  request?: typeof asaasRequest;
}

/**
 * Tokeniza o cartão no Asaas.
 *
 * Roda no servidor — diferente do gateway anterior, não há chamada do navegador
 * e portanto não há problema de CORS. O token gerado só pode ser cobrado para o
 * mesmo customerId que o originou.
 */
export async function tokenizeCard(
  input: TokenizeCardInput,
  deps: CardsDeps = {},
): Promise<AsaasTokenizeResponse> {
  const request = deps.request ?? asaasRequest;

  if (!input.remoteIp) {
    throw new Error('tokenizeCard: remoteIp é obrigatório');
  }

  const body = {
    customer: input.customerId,
    creditCard: {
      holderName: input.holderName,
      number: input.number.replace(/\D/g, ''),
      expiryMonth: String(input.expiryMonth).padStart(2, '0'),
      expiryYear: String(input.expiryYear),
      ccv: input.ccv,
    },
    creditCardHolderInfo: {
      name: input.holder.name,
      email: input.holder.email,
      cpfCnpj: input.holder.cpfCnpj.replace(/\D/g, ''),
      postalCode: input.holder.postalCode.replace(/\D/g, ''),
      addressNumber: input.holder.addressNumber,
      phone: input.holder.phone.replace(/\D/g, ''),
    },
    remoteIp: input.remoteIp,
  };

  return request<AsaasTokenizeResponse>('/v3/creditCard/tokenizeCreditCard', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/cards.test.ts`
Expected: PASS — 2 testes

- [ ] **Step 5: Commit**

```bash
git add platform/integrations/asaas/cards.ts tests/unit/asaas/cards.test.ts
git commit -m "feat(asaas): tokenização de cartão no servidor"
```

---

### Task 6: Migration do banco e registro do gateway

**Files:**
- Modify: `prisma/schema.prisma:26` (campo `pagarmeCustomerId` do model `User`)
- Create: `prisma/migrations/<timestamp>_asaas_gateway/migration.sql` (gerado pelo Prisma)
- Create: `scripts/seed-asaas-gateway.ts`

**Interfaces:**
- Consumes: nada
- Produces: campo `User.asaasCustomerId`, registro em `payment_gateways` com `slug='asaas'`

- [ ] **Step 1: Renomear o campo no schema**

Em `prisma/schema.prisma`, no model `User`, trocar a linha:

```prisma
  pagarmeCustomerId        String?
```

por:

```prisma
  asaasCustomerId          String?
```

- [ ] **Step 2: Gerar a migration**

Run: `pnpm prisma migrate dev --name asaas_gateway`
Expected: migration criada e aplicada; Prisma Client regenerado.

Confirmar que o SQL gerado contém `ALTER TABLE ... RENAME COLUMN` ou o par DROP/ADD. Como a coluna anterior nunca foi usada em produção, perder o conteúdo é aceitável.

- [ ] **Step 3: Escrever o script de registro do gateway**

Criar `scripts/seed-asaas-gateway.ts`:

```ts
/**
 * Registra (ou atualiza) o gateway Asaas e sua credencial.
 *
 * Uso: pnpm tsx scripts/seed-asaas-gateway.ts
 * Requer ASAAS_API_KEY no .env. ASAAS_WEBHOOK_TOKEN é opcional.
 */

import { prisma } from '../platform/db/db';
import { encrypt } from '../platform/integrations/shared/encryption.service';

async function main() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error('Defina ASAAS_API_KEY no .env antes de rodar');

  const baseUrl = process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com';
  const isSandbox = baseUrl.includes('sandbox');

  const gateway = await prisma.paymentGateway.upsert({
    where: { slug: 'asaas' },
    create: {
      slug: 'asaas',
      name: 'Asaas',
      description: 'Gateway de pagamento Asaas — PIX, cartão e boleto',
      status: 'ACTIVE',
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      baseUrl,
      enabledMethods: ['PIX', 'CREDIT_CARD', 'BOLETO'],
      timeout: 30000,
    },
    update: {
      status: 'ACTIVE',
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      baseUrl,
      enabledMethods: ['PIX', 'CREDIT_CARD', 'BOLETO'],
    },
  });

  await prisma.paymentCredential.updateMany({
    where: { gatewayId: gateway.id, isActive: true },
    data: { isActive: false },
  });

  await prisma.paymentCredential.create({
    data: {
      gatewayId: gateway.id,
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      authType: 'API_KEY',
      accessToken: encrypt(apiKey),
      clientSecret: process.env.ASAAS_WEBHOOK_TOKEN
        ? encrypt(process.env.ASAAS_WEBHOOK_TOKEN)
        : null,
      isActive: true,
    },
  });

  // Desativa o gateway anterior, se existir
  await prisma.paymentGateway.updateMany({
    where: { slug: 'pagarme' },
    data: { status: 'INACTIVE' },
  });

  console.log(`Gateway Asaas registrado (${gateway.id}) em ambiente ${gateway.environment}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 4: Rodar o script e conferir**

Run: `pnpm tsx scripts/seed-asaas-gateway.ts`
Expected: `Gateway Asaas registrado (...) em ambiente SANDBOX`

Conferir no banco:

```bash
psql "$(grep -oP '^DATABASE_URL="\K[^"]+' .env | sed 's/?schema=public//')" -c \
  "SELECT slug, status, environment FROM payment_gateways ORDER BY slug;"
```
Expected: `asaas | ACTIVE | SANDBOX` e `pagarme | INACTIVE`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations scripts/seed-asaas-gateway.ts
git commit -m "feat(asaas): migration do campo asaasCustomerId e registro do gateway"
```

---

### Task 7: Camada de rastreamento (cobrança + PaymentTransaction)

**Files:**
- Create: `platform/integrations/asaas/tracking.ts`
- Create: `platform/integrations/asaas/index.ts`
- Test: `tests/unit/asaas/tracking.test.ts`

**Interfaces:**
- Consumes: `createCharge`, `getPixQrCode`, `getBoletoIdentification`, `getCharge` (Task 4), `getOrCreateCustomer` (Task 3), `mapAsaasStatus`, `mapBillingTypeToMethod`, `toCents` (Task 1)
- Produces: `createAsaasPaymentWithTracking(input: CreateAsaasPaymentInput, deps?: TrackingDeps): Promise<CreateAsaasPaymentResult>`, `updatePaymentFromAsaas(chargeId: string): Promise<void>`, tipos `CreateAsaasPaymentInput` e `CreateAsaasPaymentResult`

**Nota de design:** o módulo Pagar.me misturava chamadas de API e escrita no banco no mesmo arquivo. Aqui a separação é explícita: `charges.ts` não conhece Prisma, `tracking.ts` orquestra os dois. Isso é o que torna `charges.ts` testável sem banco.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/asaas/tracking.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAsaasPaymentWithTracking } from '@/platform/integrations/asaas/tracking';

function makeDeps(overrides: Record<string, unknown> = {}) {
  const created: any[] = [];
  const updated: any[] = [];

  return {
    created,
    updated,
    deps: {
      prisma: {
        paymentGateway: { findFirst: async () => ({ id: 'gw_1' }) },
        user: {
          findUniqueOrThrow: async () => ({ id: 'u_1', asaasCustomerId: 'cus_1' }),
          update: async () => ({}),
        },
        paymentTransaction: {
          create: async ({ data }: any) => {
            created.push(data);
            return { id: 'tx_1', ...data };
          },
          update: async ({ data }: any) => {
            updated.push(data);
            return { id: 'tx_1', ...data };
          },
        },
      },
      createCharge: async () => ({
        id: 'pay_1',
        status: 'PENDING',
        billingType: 'PIX',
        value: 49.9,
        netValue: 48.91,
        dueDate: '2026-08-05',
      }),
      getPixQrCode: async () => ({
        success: true,
        payload: '00020101021226820014br.gov.bcb.pix',
        encodedImage: 'iVBORw0KGgo=',
        expirationDate: '2026-08-06 23:59:59',
      }),
      getBoletoIdentification: async () => ({
        identificationField: '46191110000000000000012832971019215320000008990',
        nossoNumero: '12832971',
        barCode: '46192153200000089901110000000000001283297101',
      }),
      getOrCreateCustomer: async () => ({ id: 'cus_1', name: 'Maria' }),
      ...overrides,
    } as never,
  };
}

const input = {
  userId: 'u_1',
  userName: 'Maria',
  userEmail: 'maria@teste.com',
  amountCents: 4990,
  description: 'Envio',
  paymentMethod: 'pix' as const,
  dueDate: '2026-08-05',
  metadata: { type: 'checkout_payment' as const },
};

describe('createAsaasPaymentWithTracking', () => {
  it('registra a transação em centavos e devolve o QR Code do PIX', async () => {
    const { deps, created, updated } = makeDeps();
    const result = await createAsaasPaymentWithTracking(input, deps);

    assert.equal(created[0].amountCents, 4990);
    assert.equal(created[0].status, 'PENDING');
    assert.equal(created[0].method, 'PIX');

    assert.equal(updated[0].externalId, 'pay_1');
    assert.equal(updated[0].netCents, 4891, 'netValue convertido para centavos');
    assert.equal(updated[0].feeCents, 99, 'taxa = bruto - líquido');

    assert.equal(result.pixQrCode, '00020101021226820014br.gov.bcb.pix');
    assert.ok(result.pixQrCodeImage?.startsWith('data:image/png;base64,'));
  });

  it('devolve linha digitável e PDF quando é boleto', async () => {
    const { deps } = makeDeps({
      createCharge: async () => ({
        id: 'pay_2',
        status: 'PENDING',
        billingType: 'BOLETO',
        value: 89.9,
        netValue: 88.91,
        dueDate: '2026-08-08',
        bankSlipUrl: 'https://sandbox.asaas.com/b/pdf/xyz',
      }),
    });

    const result = await createAsaasPaymentWithTracking(
      { ...input, paymentMethod: 'boleto', amountCents: 8990 },
      deps,
    );

    assert.equal(result.boletoUrl, 'https://sandbox.asaas.com/b/pdf/xyz');
    assert.equal(
      result.boletoBarcode,
      '46191110000000000000012832971019215320000008990',
    );
  });

  it('marca a transação como FAILED quando a cobrança é recusada', async () => {
    const { deps, updated } = makeDeps({
      createCharge: async () => {
        throw new Error('Transação não autorizada');
      },
    });

    await assert.rejects(
      () => createAsaasPaymentWithTracking({ ...input, paymentMethod: 'credit_card' }, deps),
      /Transação não autorizada/,
    );
    assert.equal(updated[0].status, 'FAILED');
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/tracking.test.ts`
Expected: FAIL — módulo `tracking` não encontrado

- [ ] **Step 3: Implementar**

Criar `platform/integrations/asaas/tracking.ts`:

```ts
import 'server-only';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import type { PaymentTransaction } from '@prisma/client';
import { prisma as defaultPrisma } from '@/platform/db/db';
import { createCharge, getPixQrCode, getBoletoIdentification, getCharge } from './charges';
import { getOrCreateCustomer } from './customers';
import { toCents } from './money';
import { mapAsaasStatus, mapBillingTypeToMethod } from './status';

export interface CreateAsaasPaymentInput {
  userId: string;
  userName: string;
  userEmail: string;
  userDocument?: string;
  userPhone?: string;
  amountCents: number;
  description: string;
  dueDate: string;
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
  cardToken?: string;
  remoteIp?: string;
  installments?: number;
  metadata: Record<string, string> & {
    type: 'wallet_topup' | 'checkout_payment' | 'recipient_payment';
  };
}

export interface CreateAsaasPaymentResult {
  transaction: PaymentTransaction;
  chargeId: string;
  status: string;
  pixQrCode?: string;
  pixQrCodeImage?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  cardBrand?: string;
  cardLast4?: string;
  invoiceUrl?: string;
}

export interface TrackingDeps {
  prisma?: typeof defaultPrisma;
  createCharge?: typeof createCharge;
  getPixQrCode?: typeof getPixQrCode;
  getBoletoIdentification?: typeof getBoletoIdentification;
  getOrCreateCustomer?: typeof getOrCreateCustomer;
}

export async function createAsaasPaymentWithTracking(
  input: CreateAsaasPaymentInput,
  deps: TrackingDeps = {},
): Promise<CreateAsaasPaymentResult> {
  const db = deps.prisma ?? defaultPrisma;
  const doCreateCharge = deps.createCharge ?? createCharge;
  const doGetPixQrCode = deps.getPixQrCode ?? getPixQrCode;
  const doGetBoleto = deps.getBoletoIdentification ?? getBoletoIdentification;
  const doGetOrCreateCustomer = deps.getOrCreateCustomer ?? getOrCreateCustomer;

  const gateway = await db.paymentGateway.findFirst({
    where: { slug: 'asaas', status: 'ACTIVE' },
  });
  if (!gateway) throw new Error('Gateway Asaas não configurado ou inativo');

  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
  let customerId = (user as Record<string, unknown>).asaasCustomerId as string | undefined;

  if (!customerId) {
    const customer = await doGetOrCreateCustomer({
      name: input.userName,
      email: input.userEmail,
      document: input.userDocument,
      phone: input.userPhone,
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: input.userId },
      data: { asaasCustomerId: customerId } as Prisma.UserUpdateInput,
    });
  }

  const referenceId = `as_${nanoid(16)}`;

  const transaction = await db.paymentTransaction.create({
    data: {
      gatewayId: gateway.id,
      referenceId,
      userId: input.userId,
      method:
        input.paymentMethod === 'pix'
          ? 'PIX'
          : input.paymentMethod === 'boleto'
            ? 'BOLETO'
            : 'CREDIT_CARD',
      status: 'PENDING',
      amountCents: input.amountCents,
      feeCents: 0,
      netCents: input.amountCents,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });

  try {
    const charge = await doCreateCharge({
      customerId,
      amountCents: input.amountCents,
      description: input.description,
      referenceId,
      dueDate: input.dueDate,
      paymentMethod: input.paymentMethod,
      cardToken: input.cardToken,
      remoteIp: input.remoteIp,
      installments: input.installments,
    });

    const status = mapAsaasStatus(charge.status);
    const netCents = charge.netValue != null ? toCents(charge.netValue) : input.amountCents;

    const result: CreateAsaasPaymentResult = {
      transaction,
      chargeId: charge.id,
      status,
      cardBrand: charge.creditCard?.creditCardBrand,
      cardLast4: charge.creditCard?.creditCardNumber,
      invoiceUrl: charge.invoiceUrl,
    };

    if (input.paymentMethod === 'pix') {
      const qr = await doGetPixQrCode(charge.id);
      result.pixQrCode = qr.payload;
      result.pixQrCodeImage = `data:image/png;base64,${qr.encodedImage}`;
    }

    if (input.paymentMethod === 'boleto') {
      const boleto = await doGetBoleto(charge.id);
      result.boletoUrl = charge.bankSlipUrl;
      result.boletoBarcode = boleto.identificationField;
    }

    const updated = await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        externalId: charge.id,
        status,
        method: mapBillingTypeToMethod(charge.billingType),
        netCents,
        feeCents: input.amountCents - netCents,
        cardBrand: result.cardBrand,
        cardLast4: result.cardLast4,
        pixQrCode: result.pixQrCode,
        boletoUrl: result.boletoUrl,
        boletoBarcode: result.boletoBarcode,
        authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
        paidAt: status === 'PAID' ? new Date() : undefined,
      },
    });

    return { ...result, transaction: updated };
  } catch (error) {
    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

/** Reconsulta a cobrança no Asaas e sincroniza o status da transação local. */
export async function updatePaymentFromAsaas(chargeId: string): Promise<void> {
  const charge = await getCharge(chargeId);
  const status = mapAsaasStatus(charge.status);
  const netCents = charge.netValue != null ? toCents(charge.netValue) : undefined;

  await defaultPrisma.paymentTransaction.updateMany({
    where: { externalId: chargeId },
    data: {
      status,
      ...(netCents != null ? { netCents, feeCents: toCents(charge.value) - netCents } : {}),
      paidAt: status === 'PAID' ? new Date() : undefined,
      authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
    },
  });
}
```

- [ ] **Step 4: Criar o index do módulo**

Criar `platform/integrations/asaas/index.ts`:

```ts
// platform/integrations/asaas/index.ts
export type {
  AsaasConfig,
  AsaasCustomer,
  AsaasCharge,
  AsaasPixQrCode,
  AsaasBoletoIdentification,
  AsaasTokenizeResponse,
  AsaasWebhookPayload,
  AsaasBillingType,
} from './types';
export { AsaasApiError } from './types';
export { toCents, toReais } from './money';
export { mapAsaasStatus, mapBillingTypeToMethod, mapMethodToBillingType } from './status';
export { getAsaasConfig, invalidateAsaasConfigCache, isAsaasConfigured } from './config';
export { asaasRequest } from './client';
export { getOrCreateCustomer, getCustomerById } from './customers';
export type { GetOrCreateCustomerInput } from './customers';
export { tokenizeCard } from './cards';
export type { TokenizeCardInput } from './cards';
export {
  createCharge,
  getCharge,
  refundCharge,
  getPixQrCode,
  getBoletoIdentification,
} from './charges';
export type { CreateChargeInput } from './charges';
export { createAsaasPaymentWithTracking, updatePaymentFromAsaas } from './tracking';
export type { CreateAsaasPaymentInput, CreateAsaasPaymentResult } from './tracking';
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/tracking.test.ts`
Expected: PASS — 3 testes

- [ ] **Step 6: Rodar toda a suíte do módulo**

Run: `pnpm test:unit -- tests/unit/asaas/`
Expected: PASS — 34 testes (money 5, status 9, client 4, customers 3, charges 8, cards 2, tracking 3)

- [ ] **Step 7: Commit**

```bash
git add platform/integrations/asaas/tracking.ts platform/integrations/asaas/index.ts tests/unit/asaas/tracking.test.ts
git commit -m "feat(asaas): camada de rastreamento ligando cobrança e PaymentTransaction"
```

---

### Task 8: Webhooks — validação e mapeamento de eventos

**Files:**
- Create: `platform/integrations/asaas/webhooks.ts`
- Test: `tests/unit/asaas/webhooks.test.ts`

**Interfaces:**
- Consumes: `AsaasWebhookPayload` (Task 1), `mapAsaasStatus` (Task 1)
- Produces: `verifyWebhookToken(receivedToken: string | null, expectedToken?: string): boolean`, `extractChargeFromPayload(payload: unknown): AsaasCharge | null`, `isRelevantEvent(event: string): boolean`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/asaas/webhooks.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyWebhookToken,
  extractChargeFromPayload,
  isRelevantEvent,
} from '@/platform/integrations/asaas/webhooks';

const TOKEN = 'a'.repeat(40);

describe('verifyWebhookToken', () => {
  it('aceita quando o token confere', () => {
    assert.equal(verifyWebhookToken(TOKEN, TOKEN), true);
  });

  it('rejeita token diferente', () => {
    assert.equal(verifyWebhookToken('b'.repeat(40), TOKEN), false);
  });

  it('rejeita quando o header não veio', () => {
    assert.equal(verifyWebhookToken(null, TOKEN), false);
  });

  it('rejeita quando não há token configurado — nunca aceitar por omissão', () => {
    assert.equal(verifyWebhookToken(TOKEN, undefined), false);
    assert.equal(verifyWebhookToken(TOKEN, ''), false);
  });

  it('rejeita tokens de tamanhos diferentes sem estourar', () => {
    assert.equal(verifyWebhookToken('curto', TOKEN), false);
  });
});

describe('extractChargeFromPayload', () => {
  it('extrai a cobrança do evento', () => {
    const charge = extractChargeFromPayload({
      id: 'evt_1',
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_1', status: 'CONFIRMED', billingType: 'CREDIT_CARD', value: 10 },
    });
    assert.equal(charge?.id, 'pay_1');
  });

  it('devolve null quando o corpo não tem cobrança', () => {
    assert.equal(extractChargeFromPayload({ id: 'evt_1', event: 'PAYMENT_CONFIRMED' }), null);
    assert.equal(extractChargeFromPayload(null), null);
    assert.equal(extractChargeFromPayload('texto'), null);
  });
});

describe('isRelevantEvent', () => {
  it('aceita eventos que mudam o estado do pagamento', () => {
    for (const evt of [
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_REFUNDED',
      'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
    ]) {
      assert.equal(isRelevantEvent(evt), true, evt);
    }
  });

  it('ignora eventos puramente informativos', () => {
    assert.equal(isRelevantEvent('PAYMENT_CREATED'), false);
    assert.equal(isRelevantEvent('PAYMENT_UPDATED'), false);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/webhooks.test.ts`
Expected: FAIL — módulo `webhooks` não encontrado

- [ ] **Step 3: Implementar**

Criar `platform/integrations/asaas/webhooks.ts`:

```ts
import 'server-only';
import { timingSafeEqual } from 'crypto';
import type { AsaasCharge } from './types';

/**
 * Valida o header `asaas-access-token`.
 *
 * O valor é definido por nós ao cadastrar o webhook no painel do Asaas.
 * Se não houver token configurado, a validação FALHA — nunca aceitar por omissão,
 * senão o endpoint fica aberto para qualquer origem.
 */
export function verifyWebhookToken(
  receivedToken: string | null,
  expectedToken?: string,
): boolean {
  if (!expectedToken || !receivedToken) return false;

  const a = Buffer.from(receivedToken);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function extractChargeFromPayload(payload: unknown): AsaasCharge | null {
  if (!payload || typeof payload !== 'object') return null;
  const payment = (payload as { payment?: unknown }).payment;
  if (!payment || typeof payment !== 'object') return null;
  if (typeof (payment as { id?: unknown }).id !== 'string') return null;
  return payment as AsaasCharge;
}

const RELEVANT_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIVED_IN_CASH',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
]);

/** Eventos como PAYMENT_CREATED/UPDATED não alteram nosso estado e são ignorados. */
export function isRelevantEvent(event: string): boolean {
  return RELEVANT_EVENTS.has(event);
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/webhooks.test.ts`
Expected: PASS — 10 testes

- [ ] **Step 5: Exportar do index**

Em `platform/integrations/asaas/index.ts`, acrescentar ao final:

```ts
export { verifyWebhookToken, extractChargeFromPayload, isRelevantEvent } from './webhooks';
```

- [ ] **Step 6: Commit**

```bash
git add platform/integrations/asaas/webhooks.ts platform/integrations/asaas/index.ts tests/unit/asaas/webhooks.test.ts
git commit -m "feat(asaas): validação de webhook por token e filtro de eventos"
```

---

## Fase 2 — Rotas de API

### Task 9: Rotas de criação de pagamento e tokenização

**Files:**
- Create: `app/api/payments/asaas/create/route.ts`
- Create: `app/api/payments/asaas/tokenize/route.ts`
- Test: `tests/integration/payments/asaas-create-auth.test.ts`

**Interfaces:**
- Consumes: `createAsaasPaymentWithTracking` (Task 7), `tokenizeCard` (Task 5), `getOrCreateCustomer` (Task 3)
- Produces: `POST /api/payments/asaas/create` → `{ transactionId, chargeId, status, pixQrCode?, pixQrCodeImage?, boletoUrl?, boletoBarcode?, invoiceUrl? }`; `POST /api/payments/asaas/tokenize` → `{ token, brand, last4 }`

**Referência:** copiar a estrutura de `app/api/payments/pagarme/create/route.ts` (autenticação via `getSession`, validação via Zod, `withApiHandler`). Consultar `tests/integration/cart/cart-api.test.ts` para o padrão de teste de rota autenticada.

- [ ] **Step 1: Escrever o teste de autenticação que falha**

Criar `tests/integration/payments/asaas-create-auth.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('POST /api/payments/asaas/create', () => {
  it('exige autenticação', async () => {
    const { POST } = await import('@/app/api/payments/asaas/create/route');
    const req = new Request('http://localhost/api/payments/asaas/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 4990,
        description: 'Envio',
        paymentMethod: 'pix',
        metadata: { type: 'checkout_payment' },
      }),
    });

    const res = await POST(req as never, { params: Promise.resolve({}) } as never);
    assert.equal(res.status, 401);
  });

  it('rejeita método de pagamento desconhecido', async () => {
    const { POST } = await import('@/app/api/payments/asaas/create/route');
    const req = new Request('http://localhost/api/payments/asaas/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 4990,
        description: 'Envio',
        paymentMethod: 'cheque',
        metadata: { type: 'checkout_payment' },
      }),
    });

    const res = await POST(req as never, { params: Promise.resolve({}) } as never);
    assert.ok(res.status === 400 || res.status === 401);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:integration -- tests/integration/payments/asaas-create-auth.test.ts`
Expected: FAIL — rota não encontrada

- [ ] **Step 3: Implementar a rota de criação**

Criar `app/api/payments/asaas/create/route.ts`:

```ts
/**
 * POST /api/payments/asaas/create
 *
 * Cria uma cobrança no Asaas. Suporta PIX, cartão de crédito e boleto.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { getSession } from '@/modules/auth/application/session';
import { createAsaasPaymentWithTracking } from '@/platform/integrations/asaas';
import { prisma } from '@/platform/db/db';

const createPaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().min(1),
  paymentMethod: z.enum(['credit_card', 'pix', 'boleto']),
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
  boletoDueDays: z.number().int().min(1).max(30).optional(),
  metadata: z.object({
    type: z.enum(['wallet_topup', 'checkout_payment']),
    shipmentId: z.string().optional(),
    shipmentIds: z.array(z.string()).optional(),
  }),
});

type PaymentResponse = {
  transactionId: string;
  chargeId: string;
  status: string;
  pixQrCode?: string;
  pixQrCodeImage?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  invoiceUrl?: string;
};

/** Vencimento: hoje para PIX e cartão; prazo configurável para boleto. */
function buildDueDate(method: string, boletoDueDays = 3): string {
  const date = new Date();
  if (method === 'boleto') date.setDate(date.getDate() + boletoDueDays);
  return date.toISOString().slice(0, 10);
}

export const POST = withApiHandler<PaymentResponse>(async (context) => {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized('Não autenticado');

  const parsed = createPaymentSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    throw ApiError.validation('Dados inválidos', parsed.error.flatten());
  }
  const data = parsed.data;

  const remoteIp = context.req.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (data.paymentMethod === 'credit_card' && !remoteIp) {
    throw ApiError.badRequest('Não foi possível identificar o IP de origem');
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, cpf: true, phone: true },
  });

  const metadata: Record<string, string> & { type: 'wallet_topup' | 'checkout_payment' } = {
    type: data.metadata.type,
    userId: session.userId,
  };
  if (data.metadata.shipmentId) metadata.shipmentId = data.metadata.shipmentId;
  if (data.metadata.shipmentIds) metadata.shipmentIds = JSON.stringify(data.metadata.shipmentIds);

  const result = await createAsaasPaymentWithTracking({
    userId: session.userId,
    userName: user.name,
    userEmail: user.email,
    userDocument: user.cpf?.replace(/\D/g, '') || undefined,
    userPhone: user.phone || undefined,
    amountCents: data.amountCents,
    description: data.description,
    dueDate: buildDueDate(data.paymentMethod, data.boletoDueDays),
    paymentMethod: data.paymentMethod,
    cardToken: data.cardToken,
    remoteIp,
    installments: data.installments,
    metadata,
  });

  if (result.status === 'FAILED') {
    throw ApiError.badRequest('Pagamento recusado pela operadora', { status: result.status });
  }

  return {
    data: {
      transactionId: result.transaction.id,
      chargeId: result.chargeId,
      status: result.status,
      pixQrCode: result.pixQrCode,
      pixQrCodeImage: result.pixQrCodeImage,
      boletoUrl: result.boletoUrl,
      boletoBarcode: result.boletoBarcode,
      invoiceUrl: result.invoiceUrl,
    },
    status: 201,
  };
});
```

- [ ] **Step 4: Implementar a rota de tokenização**

Criar `app/api/payments/asaas/tokenize/route.ts`:

```ts
/**
 * POST /api/payments/asaas/tokenize
 *
 * Tokeniza um cartão no Asaas. Roda no servidor — não há chamada do navegador
 * à API do gateway, então não existe restrição de CORS.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { getSession } from '@/modules/auth/application/session';
import { tokenizeCard, getOrCreateCustomer } from '@/platform/integrations/asaas';
import { prisma } from '@/platform/db/db';
import { Prisma } from '@prisma/client';

const tokenizeSchema = z.object({
  number: z.string().min(13),
  holderName: z.string().min(1),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(2024).max(2099),
  ccv: z.string().min(3).max(4),
  postalCode: z.string().min(8),
  addressNumber: z.string().min(1),
});

type TokenizeResponse = { token: string; brand: string; last4: string };

export const POST = withApiHandler<TokenizeResponse>(async (context) => {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized('Não autenticado');

  const parsed = tokenizeSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    throw ApiError.validation('Dados do cartão inválidos', parsed.error.flatten());
  }
  const data = parsed.data;

  const remoteIp = context.req.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (!remoteIp) throw ApiError.badRequest('Não foi possível identificar o IP de origem');

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, cpf: true, phone: true, asaasCustomerId: true },
  });

  if (!user.cpf) throw ApiError.badRequest('Cadastre seu CPF antes de salvar um cartão');

  let customerId = user.asaasCustomerId;
  if (!customerId) {
    const customer = await getOrCreateCustomer({
      name: user.name,
      email: user.email,
      document: user.cpf,
      phone: user.phone || undefined,
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { asaasCustomerId: customerId } as Prisma.UserUpdateInput,
    });
  }

  const result = await tokenizeCard({
    customerId,
    holderName: data.holderName,
    number: data.number,
    expiryMonth: data.expMonth,
    expiryYear: data.expYear,
    ccv: data.ccv,
    remoteIp,
    holder: {
      name: user.name,
      email: user.email,
      cpfCnpj: user.cpf,
      postalCode: data.postalCode,
      addressNumber: data.addressNumber,
      phone: user.phone || '',
    },
  });

  return {
    data: {
      token: result.creditCardToken,
      brand: result.creditCardBrand,
      last4: result.creditCardNumber,
    },
  };
});
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `pnpm test:integration -- tests/integration/payments/asaas-create-auth.test.ts`
Expected: PASS — 2 testes

- [ ] **Step 6: Commit**

```bash
git add app/api/payments/asaas tests/integration/payments/
git commit -m "feat(asaas): rotas de criação de cobrança e tokenização de cartão"
```

---

### Task 10: Rota de webhook e worker

**Files:**
- Create: `app/api/webhooks/asaas/route.ts`
- Create: `workers/webhook/asaas.worker.ts`
- Modify: `platform/queue/queues.ts`, `platform/queue/types.ts`, `platform/queue/index.ts`
- Test: `tests/integration/webhooks/asaas-webhook.test.ts`

**Interfaces:**
- Consumes: `verifyWebhookToken`, `extractChargeFromPayload`, `isRelevantEvent` (Task 8), `getAsaasConfig` (Task 2), `mapAsaasStatus` (Task 1)
- Produces: `POST /api/webhooks/asaas` → 200 sempre que autenticado; fila `asaas-webhook`

**Padrão obrigatório:** responder 200 rapidamente e processar de forma assíncrona. O Asaas pausa a fila após 15 falhas consecutivas e a entrega é *at-least-once*.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/integration/webhooks/asaas-webhook.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function makeRequest(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['asaas-access-token'] = token;
  return new Request('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/webhooks/asaas', () => {
  it('rejeita requisição sem o header de token', async () => {
    const { POST } = await import('@/app/api/webhooks/asaas/route');
    const res = await POST(
      makeRequest({ id: 'evt_1', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1' } }) as never,
      { params: Promise.resolve({}) } as never,
    );
    assert.equal(res.status, 401);
  });

  it('rejeita token inválido', async () => {
    const { POST } = await import('@/app/api/webhooks/asaas/route');
    const res = await POST(
      makeRequest(
        { id: 'evt_1', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1' } },
        'token-errado',
      ) as never,
      { params: Promise.resolve({}) } as never,
    );
    assert.equal(res.status, 401);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:integration -- tests/integration/webhooks/asaas-webhook.test.ts`
Expected: FAIL — rota não encontrada

- [ ] **Step 3: Implementar a rota de webhook**

Criar `app/api/webhooks/asaas/route.ts`:

```ts
/**
 * POST /api/webhooks/asaas
 *
 * Recebe eventos de cobrança do Asaas.
 *
 * Regras impostas pelo provedor:
 * - Responder 2xx o mais rápido possível; após 15 falhas seguidas a fila é pausada
 * - Entrega é at-least-once — o mesmo evento pode chegar mais de uma vez
 * Por isso: valida, persiste o evento e enfileira. O processamento é do worker.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/platform/db/db';
import {
  getAsaasConfig,
  verifyWebhookToken,
  extractChargeFromPayload,
  isRelevantEvent,
} from '@/platform/integrations/asaas';
import { enqueueAsaasWebhook } from '@/platform/queue';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const config = await getAsaasConfig();
  const received = req.headers.get('asaas-access-token');

  if (!verifyWebhookToken(received, config?.webhookToken)) {
    console.warn('[ASAAS_WEBHOOK] Token inválido ou ausente');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const event = (payload as { event?: string }).event ?? '';
  const charge = extractChargeFromPayload(payload);

  if (!charge || !isRelevantEvent(event)) {
    // Evento informativo ou sem cobrança: confirmar para não travar a fila do Asaas
    return NextResponse.json({ received: true });
  }

  const gateway = await prisma.paymentGateway.findFirst({ where: { slug: 'asaas' } });
  if (!gateway) return NextResponse.json({ received: true });

  try {
    await prisma.paymentWebhook.create({
      data: {
        gatewayId: gateway.id,
        eventType: event,
        externalId: charge.id,
        payload: payload as never,
        status: 'PENDING',
      },
    });
    await enqueueAsaasWebhook({ chargeId: charge.id, event });
  } catch (error) {
    // Violação de unicidade (gatewayId + externalId) = evento repetido. Já temos.
    const code = (error as { code?: string }).code;
    if (code !== 'P2002') {
      console.error('[ASAAS_WEBHOOK] Falha ao registrar evento:', error);
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Registrar a fila**

Em `platform/queue/types.ts`, acrescentar o tipo do job:

```ts
export interface AsaasWebhookJobData {
  chargeId: string;
  event: string;
}
```

Em `platform/queue/queues.ts`, seguir exatamente o padrão da fila `pagarme-webhook` já existente, criando `asaas-webhook` com o mesmo formato de opções (tentativas, backoff, remoção). Em `platform/queue/index.ts`, exportar `enqueueAsaasWebhook(data: AsaasWebhookJobData): Promise<void>` espelhando a função equivalente do Pagar.me.

- [ ] **Step 5: Implementar o worker**

Criar `workers/webhook/asaas.worker.ts` espelhando `workers/webhook/pagarme.worker.ts`, com estas diferenças:

```ts
import { updatePaymentFromAsaas } from '@/platform/integrations/asaas';
import { prisma } from '@/platform/db/db';

// Dentro do processador do job:
export async function processAsaasWebhookJob(data: { chargeId: string; event: string }) {
  await updatePaymentFromAsaas(data.chargeId);

  await prisma.paymentWebhook.updateMany({
    where: { externalId: data.chargeId, status: 'PENDING' },
    data: { status: 'PROCESSED', processedAt: new Date() },
  });
}
```

Manter a mesma estratégia de retry, log e marcação de erro do worker anterior.

- [ ] **Step 6: Rodar o teste para confirmar que passa**

Run: `pnpm test:integration -- tests/integration/webhooks/asaas-webhook.test.ts`
Expected: PASS — 2 testes

- [ ] **Step 7: Commit**

```bash
git add app/api/webhooks/asaas workers/webhook/asaas.worker.ts platform/queue tests/integration/webhooks/
git commit -m "feat(asaas): recebimento de webhooks com validação por token e fila assíncrona"
```

---

### Task 11: Estorno, consulta e cofre de cartões

**Files:**
- Modify: `app/api/payments/[id]/refund/route.ts`
- Modify: `app/api/payments/[id]/refresh/route.ts`
- Modify: `app/api/account/cards/route.ts`
- Modify: `app/api/account/cards/[id]/route.ts`
- Modify: `modules/auth/application/account-cards.service.ts`
- Modify: `app/api/admin/payment-transactions/sync/route.ts`

**Interfaces:**
- Consumes: `refundCharge`, `getCharge` (Task 4), `updatePaymentFromAsaas` (Task 7), `mapAsaasStatus` (Task 1)
- Produces: nenhuma interface nova — são conversões de chamada

- [ ] **Step 1: Converter a rota de estorno**

Em `app/api/payments/[id]/refund/route.ts`, substituir o import e a chamada:

```ts
// antes
import { cancelCharge } from '@/platform/integrations/pagarme';
// depois
import { refundCharge } from '@/platform/integrations/asaas';
```

A chamada `cancelCharge(chargeId, amountCents)` vira `refundCharge(externalId, amountCents)`. Atenção: o Asaas estorna pelo **id da cobrança** (`payment_transactions.externalId`), não por um id de charge separado — o campo de `chargeId` que existia no metadata deixa de ser necessário.

- [ ] **Step 2: Converter a rota de consulta**

Em `app/api/payments/[id]/refresh/route.ts`, trocar `updatePaymentFromPagarme` por `updatePaymentFromAsaas`, mantendo a mesma assinatura de rota e resposta.

- [ ] **Step 3: Converter o cofre de cartões**

Em `modules/auth/application/account-cards.service.ts` e nas rotas `app/api/account/cards/*`:

- Onde havia `createPagarmeCard(customerId, token)` seguido de gravação local, agora o token **já vem pronto** da rota de tokenização (Task 9) — não existe endpoint de "salvar cartão no cofre" no Asaas. O token retornado por `tokenizeCard` é o que fica guardado.
- Onde havia `deletePagarmeCard(customerId, cardId)`, remover a chamada remota: o Asaas não expõe exclusão de token. A exclusão passa a ser apenas local (apagar o registro do cartão no nosso banco).
- Onde havia `listPagarmeCards`, usar exclusivamente a listagem local.

Registrar essa diferença em comentário no serviço, para que ninguém procure por um endpoint que não existe.

- [ ] **Step 4: Converter a sincronização administrativa**

Em `app/api/admin/payment-transactions/sync/route.ts`, trocar a busca de order do Pagar.me por `getCharge(externalId)` e o mapeamento de status por `mapAsaasStatus`.

- [ ] **Step 5: Verificar que compila**

Run: `pnpm exec tsc --noEmit`
Expected: nenhum erro nos arquivos alterados nesta task (erros remanescentes em arquivos ainda não convertidos são esperados até a Task 17).

- [ ] **Step 6: Commit**

```bash
git add app/api/payments app/api/account/cards modules/auth/application/account-cards.service.ts app/api/admin/payment-transactions/sync/route.ts
git commit -m "feat(asaas): estorno, consulta de cobrança e cofre de cartões"
```

---

### Task 12: Fluxos de negócio — carteira, carrinho e destinatário

**Files:**
- Modify: `modules/wallet/application/wallet.service.ts`
- Modify: `modules/cart/application/create-cart-shipments-with-payment.service.ts`
- Modify: `modules/shipments/application/create-paid-shipment.service.ts`
- Modify: `app/api/cart/checkout-paid/route.ts`
- Modify: `app/api/shipments/create-paid/route.ts`
- Modify: `app/api/recipient-payment/create-payment/route.ts`
- Modify: `app/api/recipient-payment/refresh-status/route.ts`

**Interfaces:**
- Consumes: `createAsaasPaymentWithTracking`, `updatePaymentFromAsaas` (Task 7)
- Produces: nenhuma interface nova

**Regra desta task:** todo `paymentMethod` passa a aceitar `'boleto'` além de `'pix'` e `'credit_card'`, conforme a spec — os três meios ficam disponíveis nos três fluxos, sem exceção.

- [ ] **Step 1: Converter o serviço de carteira**

Em `modules/wallet/application/wallet.service.ts`, trocar o import de `createPagarmePaymentWithTracking` por `createAsaasPaymentWithTracking` e acrescentar `dueDate` à chamada (hoje para PIX/cartão, hoje + 3 dias para boleto). Ampliar o tipo do método de pagamento para incluir `'boleto'`.

- [ ] **Step 2: Criar a regra de liberação e testá-la**

Esta é a regra mais crítica do plano: liberar envio para um boleto não pago significa prejuízo direto. Ela vira uma função própria, com teste, em vez de ficar espalhada por condicionais.

Criar `tests/unit/asaas/release.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canReleaseService } from '@/platform/integrations/asaas/release';

describe('canReleaseService', () => {
  it('libera quando o cartão foi aprovado', () => {
    assert.equal(canReleaseService('CAPTURED'), true);
  });

  it('libera quando o pagamento foi recebido', () => {
    assert.equal(canReleaseService('PAID'), true);
  });

  it('NÃO libera enquanto o pagamento está pendente', () => {
    assert.equal(canReleaseService('PENDING'), false);
  });

  it('NÃO libera em falha, cancelamento, estorno ou contestação', () => {
    for (const status of ['FAILED', 'CANCELED', 'REFUNDED', 'CHARGEBACK'] as const) {
      assert.equal(canReleaseService(status), false, status);
    }
  });
});
```

Criar `platform/integrations/asaas/release.ts`:

```ts
import type { TransactionStatus } from '@prisma/client';

/**
 * Decide se o serviço (emissão de etiqueta, crédito na carteira) pode ser liberado.
 *
 * CAPTURED = cartão aprovado (segundos). PAID = dinheiro recebido.
 * Qualquer outro estado — em especial PENDING, que é o caso do boleto recém-gerado
 * e do PIX ainda não pago — NÃO libera nada. Nesses casos quem libera é o worker
 * de webhook, quando o Asaas confirmar o pagamento.
 */
export function canReleaseService(status: TransactionStatus): boolean {
  return status === 'CAPTURED' || status === 'PAID';
}
```

Run: `pnpm test:unit -- tests/unit/asaas/release.test.ts`
Expected: PASS — 4 testes

Exportar em `platform/integrations/asaas/index.ts`:

```ts
export { canReleaseService } from './release';
```

- [ ] **Step 3: Converter o checkout do carrinho aplicando a regra**

Em `modules/cart/application/create-cart-shipments-with-payment.service.ts` e `app/api/cart/checkout-paid/route.ts`:

- Trocar `createPagarmePaymentWithTracking` por `createAsaasPaymentWithTracking`
- Ampliar o enum Zod de `z.enum(['credit_card', 'pix'])` para `z.enum(['credit_card', 'pix', 'boleto'])`
- Substituir a condição que hoje decide criar o envio por `canReleaseService(result.status)`:

```ts
import { canReleaseService } from '@/platform/integrations/asaas';

const result = await createAsaasPaymentWithTracking({ /* ... */ });

if (canReleaseService(result.status)) {
  await createShipmentsForTransaction(result.transaction.id);
} else if (result.status === 'FAILED') {
  throw ApiError.badRequest('Pagamento recusado pela operadora');
}
// PENDING (boleto gerado, PIX aguardando): não cria envio.
// O worker de webhook cria quando o Asaas confirmar o pagamento.
```

- [ ] **Step 4: Converter o envio pago avulso**

Em `modules/shipments/application/create-paid-shipment.service.ts` e `app/api/shipments/create-paid/route.ts`, aplicar exatamente as mesmas trocas do Step 3: import de `createAsaasPaymentWithTracking`, enum Zod com `'boleto'`, e o gate `canReleaseService(result.status)` antes de criar o envio.

- [ ] **Step 5: Converter o pagamento pelo destinatário**

Em `app/api/recipient-payment/create-payment/route.ts`:
- Trocar `createPagarmePaymentWithTracking` por `createAsaasPaymentWithTracking`
- Ampliar o enum para `z.enum(['credit_card', 'pix', 'boleto'])`
- Remover o campo `cardId` do schema (não existe equivalente no Asaas; o token cumpre esse papel)
- Acrescentar `dueDate` e `remoteIp` (extraídos de `x-forwarded-for`)
- Incluir `boletoUrl` e `boletoBarcode` no tipo de resposta

Em `app/api/recipient-payment/refresh-status/route.ts`, trocar por `updatePaymentFromAsaas`.

- [ ] **Step 6: Rodar os testes existentes de fluxo**

Run: `pnpm test:integration -- tests/integration/checkout-flow-consistency.test.ts`
Expected: PASS — nenhuma regressão nos fluxos de checkout

- [ ] **Step 7: Commit**

```bash
git add modules/wallet modules/cart modules/shipments app/api/cart app/api/shipments app/api/recipient-payment platform/integrations/asaas/release.ts tests/unit/asaas/release.test.ts
git commit -m "feat(asaas): converter carteira, carrinho e pagamento pelo destinatário"
```

---

### Task 13: Monitor de pendências — PIX e boleto vencido

**Files:**
- Create: `platform/integrations/asaas/pix-monitor.ts`
- Modify: `workers/payment/pix-monitor.worker.ts`
- Test: `tests/unit/asaas/pix-monitor.test.ts`

**Interfaces:**
- Consumes: `getCharge` (Task 4), `mapAsaasStatus` (Task 1)
- Produces: `syncPendingCharges(deps?: MonitorDeps): Promise<{ checked: number; updated: number; expired: number }>`

**Referência:** `platform/integrations/pagarme/pix-monitor.ts` (360 linhas) faz a varredura atual. Reaproveitar a estrutura de busca no banco e substituir a consulta remota.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/asaas/pix-monitor.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { syncPendingCharges } from '@/platform/integrations/asaas/pix-monitor';

function makeDeps(charges: Record<string, { status: string }>) {
  const updates: any[] = [];
  return {
    updates,
    deps: {
      prisma: {
        paymentTransaction: {
          findMany: async () => [
            { id: 'tx_1', externalId: 'pay_1', amountCents: 4990, method: 'PIX' },
            { id: 'tx_2', externalId: 'pay_2', amountCents: 8990, method: 'BOLETO' },
          ],
          update: async ({ where, data }: any) => {
            updates.push({ id: where.id, ...data });
            return {};
          },
        },
      },
      getCharge: async (id: string) => ({ id, ...charges[id], value: 49.9 }),
    } as never,
  };
}

describe('syncPendingCharges', () => {
  it('atualiza a transação quando o pagamento foi confirmado', async () => {
    const { deps, updates } = makeDeps({
      pay_1: { status: 'RECEIVED' },
      pay_2: { status: 'PENDING' },
    });

    const result = await syncPendingCharges(deps);

    assert.equal(result.checked, 2);
    assert.equal(result.updated, 1);
    assert.equal(updates[0].id, 'tx_1');
    assert.equal(updates[0].status, 'PAID');
  });

  it('marca boleto vencido como cancelado', async () => {
    const { deps, updates } = makeDeps({
      pay_1: { status: 'PENDING' },
      pay_2: { status: 'OVERDUE' },
    });

    const result = await syncPendingCharges(deps);

    assert.equal(result.expired, 1);
    assert.equal(updates[0].id, 'tx_2');
    assert.equal(updates[0].status, 'CANCELED');
  });

  it('não atualiza nada quando tudo segue pendente', async () => {
    const { deps, updates } = makeDeps({
      pay_1: { status: 'PENDING' },
      pay_2: { status: 'PENDING' },
    });

    const result = await syncPendingCharges(deps);

    assert.equal(result.updated, 0);
    assert.equal(updates.length, 0);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm test:unit -- tests/unit/asaas/pix-monitor.test.ts`
Expected: FAIL — módulo `pix-monitor` não encontrado

- [ ] **Step 3: Implementar**

Criar `platform/integrations/asaas/pix-monitor.ts`:

```ts
import 'server-only';
import { prisma as defaultPrisma } from '@/platform/db/db';
import { getCharge as defaultGetCharge } from './charges';
import { mapAsaasStatus } from './status';
import { toCents } from './money';

export interface MonitorDeps {
  prisma?: typeof defaultPrisma;
  getCharge?: typeof defaultGetCharge;
}

/**
 * Varre transações pendentes e sincroniza com o Asaas.
 *
 * Cobre PIX (pago fora do nosso fluxo) e boleto (compensação em 1 a 3 dias úteis,
 * ou vencimento sem pagamento — que precisa cancelar o pedido).
 */
export async function syncPendingCharges(
  deps: MonitorDeps = {},
): Promise<{ checked: number; updated: number; expired: number }> {
  const db = deps.prisma ?? defaultPrisma;
  const getCharge = deps.getCharge ?? defaultGetCharge;

  const pending = await db.paymentTransaction.findMany({
    where: { status: 'PENDING', externalId: { not: null } },
    select: { id: true, externalId: true, amountCents: true, method: true },
  });

  let updated = 0;
  let expired = 0;

  for (const tx of pending) {
    if (!tx.externalId) continue;

    try {
      const charge = await getCharge(tx.externalId);
      const status = mapAsaasStatus(charge.status);

      if (status === 'PENDING') continue;

      const netCents = charge.netValue != null ? toCents(charge.netValue) : tx.amountCents;

      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status,
          netCents,
          feeCents: tx.amountCents - netCents,
          paidAt: status === 'PAID' ? new Date() : undefined,
          authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
        },
      });

      updated += 1;
      if (status === 'CANCELED') expired += 1;
    } catch (error) {
      console.error(`[ASAAS_MONITOR] Falha ao consultar ${tx.externalId}:`, error);
    }
  }

  return { checked: pending.length, updated, expired };
}
```

- [ ] **Step 4: Apontar o worker para o novo monitor**

Em `workers/payment/pix-monitor.worker.ts`, trocar o import do monitor do Pagar.me por `syncPendingCharges` do Asaas, mantendo o mesmo agendamento e log. Atualizar o nome do log de `[PIX_MONITOR]` para refletir que agora cobre boleto também.

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `pnpm test:unit -- tests/unit/asaas/pix-monitor.test.ts`
Expected: PASS — 3 testes

- [ ] **Step 6: Exportar do index e commitar**

Em `platform/integrations/asaas/index.ts`, acrescentar:

```ts
export { syncPendingCharges } from './pix-monitor';
```

```bash
git add platform/integrations/asaas/pix-monitor.ts platform/integrations/asaas/index.ts workers/payment/pix-monitor.worker.ts tests/unit/asaas/pix-monitor.test.ts
git commit -m "feat(asaas): monitor de pendências cobrindo PIX e boleto vencido"
```

---

## Fase 3 — Interface

### Task 14: Seletor de meio de pagamento com boleto

**Files:**
- Modify: `modules/payments/ui/components/PaymentModal.tsx`
- Modify: `modules/payments/ui/components/CheckoutCartModal.tsx`
- Modify: `modules/payments/ui/components/PaidCheckoutModal.tsx`
- Modify: `modules/payments/dto/card.ts`
- Delete: `modules/payments/ui/utils/tokenizeCard.ts`

**Interfaces:**
- Consumes: `POST /api/payments/asaas/create`, `POST /api/payments/asaas/tokenize` (Task 9)
- Produces: tipo compartilhado `PaymentMethodChoice = 'pix' | 'credit_card' | 'boleto'`

- [ ] **Step 1: Definir o tipo compartilhado**

Em `modules/payments/dto/card.ts`, acrescentar:

```ts
export type PaymentMethodChoice = 'pix' | 'credit_card' | 'boleto';

export interface BoletoResult {
  boletoUrl: string;
  boletoBarcode: string;
}
```

- [ ] **Step 2: Trocar a tokenização do cliente pela rota do servidor**

Excluir `modules/payments/ui/utils/tokenizeCard.ts` (utilitário que chamava a API do Pagar.me do navegador). Nos componentes que o usavam, substituir por uma chamada `fetch` a `/api/payments/asaas/tokenize`, enviando também `postalCode` e `addressNumber` — campos que o Asaas exige e que o gateway anterior não pedia.

Se o formulário de cartão ainda não coleta CEP e número do endereço, acrescentar os dois campos com a mesma validação já usada nos formulários de endereço do projeto.

- [ ] **Step 3: Acrescentar boleto ao seletor**

Nos três modais, adicionar a terceira opção ao seletor de meio de pagamento. A opção de boleto deve exibir, junto ao rótulo, o aviso de prazo — a spec exige que o cliente entenda antes de escolher:

```tsx
<PaymentOption
  value="boleto"
  label="Boleto bancário"
  hint="Compensação em até 3 dias úteis — o envio é liberado após o pagamento"
/>
```

Seguir os componentes e classes de estilo já usados pelas opções de PIX e cartão nos mesmos arquivos; não introduzir biblioteca ou padrão visual novo.

- [ ] **Step 4: Verificar que compila e o lint passa**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sem erros nos arquivos alterados

- [ ] **Step 5: Commit**

```bash
git add modules/payments
git commit -m "feat(asaas): boleto no seletor de pagamento e tokenização via servidor"
```

---

### Task 15: Tela de boleto e acompanhamento

**Files:**
- Create: `modules/payments/ui/components/BoletoPaymentView.tsx`
- Modify: `modules/payments/ui/components/usePixPayment.ts`
- Modify: `modules/wallet/ui/components/CardPaymentForm.tsx`
- Modify: `modules/wallet/ui/components/SavedCardPaymentForm.tsx`

**Interfaces:**
- Consumes: `BoletoResult` (Task 14), resposta de `POST /api/payments/asaas/create` (Task 9)
- Produces: componente `BoletoPaymentView`

**Referência:** o componente de PIX (`PixPaymentView`, usado por `usePixPayment.ts`) já resolve o mesmo problema — exibir um código copiável e aguardar confirmação. Espelhar sua estrutura.

- [ ] **Step 1: Criar a tela de boleto**

Criar `modules/payments/ui/components/BoletoPaymentView.tsx` com:
- Linha digitável em destaque, com botão "Copiar" (reaproveitar o mesmo utilitário de cópia usado pelo PIX)
- Botão "Abrir boleto em PDF" apontando para `boletoUrl`
- Aviso de prazo: "O envio será liberado após a compensação, em até 3 dias úteis"
- Data de vencimento visível

Usar os mesmos componentes de layout, tipografia e cores já aplicados em `PixPaymentView`.

- [ ] **Step 2: Estender o hook de acompanhamento**

Em `modules/payments/ui/components/usePixPayment.ts`, generalizar o polling de status para aceitar também boleto — a lógica de consultar `/api/payments/[id]/refresh` até o status sair de `PENDING` é idêntica. Renomear as referências internas de "pix" para "pagamento pendente" onde o nome ficar enganoso, mas **manter o nome do arquivo e do hook** para não espalhar mudança desnecessária por todos os consumidores.

- [ ] **Step 3: Ligar os formulários de carteira**

Em `CardPaymentForm.tsx` e `SavedCardPaymentForm.tsx`, tratar a resposta com `boletoUrl`/`boletoBarcode` renderizando `BoletoPaymentView`, do mesmo modo que hoje tratam a resposta de PIX.

- [ ] **Step 4: Verificar que compila e o lint passa**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sem erros nos arquivos alterados

- [ ] **Step 5: Commit**

```bash
git add modules/payments modules/wallet
git commit -m "feat(asaas): tela de boleto com linha digitável e acompanhamento"
```

---

### Task 16: Painel administrativo

**Files:**
- Create: `app/(admin)/admin/asaas/page.tsx`
- Create: `app/(admin)/admin/asaas/AsaasClient.tsx`
- Create: `app/(admin)/admin/asaas/loading.tsx`
- Create: `app/api/admin/integrations/asaas/route.ts`
- Modify: `app/api/admin/payment-gateway/config/route.ts`
- Modify: `modules/admin/ui/components/PaymentGatewayConfig.tsx`
- Modify: `modules/admin/application/nav.ts`
- Modify: `modules/auth/application/route-protection.ts`
- Modify: `app/api/health/dependencies/route.ts`
- Modify: `app/api/admin/workers/webhooks/route.ts`

**Interfaces:**
- Consumes: `getAsaasConfig`, `isAsaasConfigured`, `invalidateAsaasConfigCache` (Task 2)
- Produces: rota administrativa `/admin/asaas`

- [ ] **Step 1: Portar as telas do admin**

Copiar a estrutura de `app/(admin)/admin/pagarme/` para `app/(admin)/admin/asaas/`, adaptando:
- Um único campo de chave de API (o Asaas não tem par público/secreto)
- Um campo para o token de webhook (`asaas-access-token`), com validação de 32 a 255 caracteres sem espaços
- Seletor de ambiente (Sandbox / Produção) que define `baseUrl` automaticamente

- [ ] **Step 2: Portar a rota de configuração**

Criar `app/api/admin/integrations/asaas/route.ts` espelhando a do Pagar.me, gravando a chave com `encrypt()` em `accessToken` e o token de webhook em `clientSecret`. Chamar `invalidateAsaasConfigCache()` após salvar — sem isso a mudança só vale depois de 5 minutos.

- [ ] **Step 3: Atualizar navegação, proteção de rota e health check**

- `modules/admin/application/nav.ts`: trocar o item "Pagar.me" por "Asaas" apontando para `/admin/asaas`
- `modules/auth/application/route-protection.ts`: trocar o caminho protegido
- `app/api/health/dependencies/route.ts`: trocar `isPagarmeConfigured` por `isAsaasConfigured` e o rótulo da dependência
- `app/api/admin/workers/webhooks/route.ts` e `modules/admin/ui/components/PaymentGatewayConfig.tsx`: trocar as referências de slug e rótulo

- [ ] **Step 4: Verificar que compila e o lint passa**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sem erros nos arquivos alterados

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/asaas app/api/admin modules/admin modules/auth/application/route-protection.ts app/api/health
git commit -m "feat(asaas): painel administrativo de configuração do gateway"
```

---

## Fase 4 — Remoção e validação

### Task 17: Remover o Pagar.me

**Files:**
- Delete: `platform/integrations/pagarme/` (10 arquivos)
- Delete: `app/api/payments/pagarme/`, `app/api/webhooks/pagarme/`, `app/api/admin/integrations/pagarme/`, `app/(admin)/admin/pagarme/`
- Delete: `workers/webhook/pagarme.worker.ts`
- Modify: `platform/db/env-validation.ts`, `platform/queue/queues.ts`, `platform/queue/types.ts`, `platform/queue/index.ts`
- Modify: `.env.example` (se existir)

**Interfaces:**
- Consumes: nada
- Produces: nada — esta task só remove

- [ ] **Step 1: Confirmar que não há mais referências vivas**

Run:
```bash
grep -rn "pagarme\|Pagarme\|PAGARME\|pagar\.me" --include="*.ts" --include="*.tsx" \
  app modules platform workers components 2>/dev/null | grep -v "^platform/integrations/pagarme/"
```
Expected: apenas ocorrências nos arquivos que serão apagados no próximo passo. Se aparecer alguma outra, convertê-la antes de seguir.

- [ ] **Step 2: Apagar os arquivos**

```bash
git rm -r platform/integrations/pagarme \
  app/api/payments/pagarme \
  app/api/webhooks/pagarme \
  app/api/admin/integrations/pagarme \
  "app/(admin)/admin/pagarme" \
  workers/webhook/pagarme.worker.ts
```

- [ ] **Step 3: Limpar variáveis de ambiente e filas**

Em `platform/db/env-validation.ts`, remover `PAGARME_SECRET_KEY` e `PAGARME_PUBLIC_KEY` e acrescentar `ASAAS_API_KEY` (obrigatória) e `ASAAS_WEBHOOK_TOKEN` (opcional).

Em `platform/queue/queues.ts`, `types.ts` e `index.ts`, remover a fila `pagarme-webhook` e tudo que a referencia.

- [ ] **Step 4: Verificar que o projeto compila inteiro**

Run: `pnpm exec tsc --noEmit`
Expected: **zero erros** — nesta altura toda referência ao gateway antigo já deve ter sumido.

Run: `pnpm lint`
Expected: sem erros

- [ ] **Step 5: Rodar toda a suíte**

Run: `pnpm test:all`
Expected: PASS — sem regressões

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remover integração Pagar.me — substituída pelo Asaas"
```

---

### Task 18: Homologação end-to-end no sandbox

**Files:**
- Create: `scripts/verify-asaas.ts`

**Interfaces:**
- Consumes: módulo `asaas` completo
- Produces: script de verificação executável

**Objetivo:** provar que os fluxos funcionam no app real, não apenas nos testes unitários. Os testes com mock garantem a lógica; este passo garante a integração.

- [ ] **Step 1: Escrever o script de verificação**

Criar `scripts/verify-asaas.ts`:

```ts
/**
 * Verificação end-to-end da integração Asaas em sandbox.
 *
 * Uso: pnpm tsx scripts/verify-asaas.ts
 * Exercita: autenticação, cliente, PIX + QR Code, boleto + linha digitável.
 * Não exercita cartão para não depender de dados sensíveis em script.
 */

import { getOrCreateCustomer } from '../platform/integrations/asaas/customers';
import {
  createCharge,
  getPixQrCode,
  getBoletoIdentification,
} from '../platform/integrations/asaas/charges';

function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const customer = await getOrCreateCustomer({
    name: 'Homologação EnvioLegal',
    email: 'homologacao@enviolegal.com.br',
    document: '24971563792',
    phone: '47988776655',
  });
  console.log('✓ cliente:', customer.id);

  const pix = await createCharge({
    customerId: customer.id,
    amountCents: 4990,
    description: 'Homologação PIX',
    referenceId: `verify_pix_${Date.now()}`,
    dueDate: today(),
    paymentMethod: 'pix',
  });
  const qr = await getPixQrCode(pix.id);
  console.log('✓ PIX:', pix.id, '| copia-e-cola:', qr.payload.slice(0, 40) + '...');

  const boleto = await createCharge({
    customerId: customer.id,
    amountCents: 8990,
    description: 'Homologação boleto',
    referenceId: `verify_bol_${Date.now()}`,
    dueDate: today(3),
    paymentMethod: 'boleto',
  });
  const ident = await getBoletoIdentification(boleto.id);
  console.log('✓ boleto:', boleto.id, '| linha digitável:', ident.identificationField);
  console.log('✓ PDF:', boleto.bankSlipUrl);

  console.log('\nHomologação concluída com sucesso.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Falha na homologação:', err);
    process.exit(1);
  });
```

- [ ] **Step 2: Rodar a verificação**

Run: `pnpm tsx scripts/verify-asaas.ts`
Expected: quatro linhas com `✓` e a mensagem de conclusão. Qualquer erro aqui indica problema de integração real, não de lógica.

- [ ] **Step 3: Exercitar o app pelo navegador**

Run: `pnpm dev`

Percorrer manualmente e confirmar cada um:
1. Recarga de carteira via PIX → QR Code aparece e é copiável
2. Recarga de carteira via boleto → linha digitável e PDF abrem
3. Checkout com cartão novo → cartão é salvo e a cobrança é aprovada
4. Checkout com cartão salvo → cobra sem pedir os dados de novo
5. Painel `/admin/asaas` → salva credencial e reflete o estado

- [ ] **Step 4: Registrar o webhook no painel do Asaas**

No painel de sandbox, em Integrações → Webhooks, cadastrar a URL pública do ambiente apontando para `/api/webhooks/asaas` e informar o mesmo token gravado em `ASAAS_WEBHOOK_TOKEN`. Disparar um pagamento de teste e confirmar que o registro chega em `payment_webhooks` com status `PROCESSED`.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-asaas.ts
git commit -m "chore(asaas): script de homologação end-to-end em sandbox"
```

---

## Checklist final antes de publicar

- [ ] `pnpm test:all` passa
- [ ] `pnpm exec tsc --noEmit` sem erros
- [ ] `pnpm lint` sem erros
- [ ] `pnpm tsx scripts/verify-asaas.ts` conclui com sucesso
- [ ] Webhook registrado e recebendo eventos
- [ ] `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` configurados no servidor — **o `.env` é ignorado pelo git e não sobe junto com o deploy**
- [ ] Chave de **produção** validada contra `https://api.asaas.com` antes de trocar o ambiente do gateway (a lição do Pagar.me: nunca publicar sem provar que a credencial autentica)
- [ ] Taxas reais conferidas no painel (Configurações → Taxas) e comparadas com as da spec
