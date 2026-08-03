import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// A rota importa @/platform/db/db diretamente e @/platform/integrations/asaas
// (config.ts, client.ts, cards.ts, charges.ts, customers.ts, tracking.ts, webhooks.ts),
// que puxam 'server-only' e @/platform/db/db no escopo do módulo. Sob node --test
// (CommonJS puro, fora do bundler do Next.js) isso lança na hora do require.
// Mesmo padrão de stub via require.cache usado em tests/integration/payments/asaas-create-auth.test.ts
// (Task 9) e tests/unit/asaas/tracking.test.ts (Task 7).
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = require.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const ROUTE_PATH = path.resolve(ROOT, 'app/api/webhooks/asaas/route.ts');

// Prisma stub mutável: os dois primeiros testes (rejeição por token) nunca
// chegam a usar isso. Os dois últimos (P2002 -> 200, erro genérico -> 500)
// reatribuem paymentWebhook.create logo antes de chamar POST, para exercitar
// cada ramo do catch da rota.
const mockPrisma = {
  paymentGateway: {
    findFirst: async () => ({ id: 'gw_1' }),
  },
  paymentWebhook: {
    create: async () => ({ id: 'wh_1' }),
  },
};

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = {
    id: DB_PATH,
    filename: DB_PATH,
    loaded: true,
    exports: {
      prisma: mockPrisma,
      isDatabaseUnavailableError: () => false,
      schedulePrismaReconnect: async () => {},
    },
  } as any;
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
}

stubModules();
delete require.cache[ROUTE_PATH];

// getAsaasConfig() consulta prisma.paymentGateway.findFirst com um `include`
// de credentials que nosso mock não devolve; `gateway.credentials.length`
// lança, config.ts captura e cai no fallback por variável de ambiente. Fixamos
// as env vars aqui para termos uma config válida (com um webhookToken
// conhecido) em todos os testes deste arquivo. Isso não muda o comportamento
// dos dois primeiros testes: eles rejeitam por token ausente/errado
// independentemente de qual token é o "esperado".
process.env.ASAAS_API_KEY = process.env.ASAAS_API_KEY || 'test_api_key';
process.env.ASAAS_WEBHOOK_TOKEN = 'test_webhook_token';
const VALID_TOKEN = 'test_webhook_token';

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

  it('evento repetido (P2002 ao persistir) responde 200 — sucesso idempotente', async () => {
    mockPrisma.paymentGateway.findFirst = async () => ({ id: 'gw_1' });
    mockPrisma.paymentWebhook.create = (async () => {
      const err = new Error('Unique constraint failed on the fields: (`gatewayId`,`externalId`)') as Error & { code?: string };
      err.code = 'P2002';
      throw err;
    }) as never;

    const { POST } = await import('@/app/api/webhooks/asaas/route');
    const res = await POST(
      makeRequest(
        { id: 'evt_dup', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_dup' } },
        VALID_TOKEN,
      ) as never,
      { params: Promise.resolve({}) } as never,
    );

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.received, true);
  });

  it('falha genérica ao persistir o webhook (ex.: banco fora do ar) responde 500, para o Asaas retransmitir', async () => {
    mockPrisma.paymentGateway.findFirst = async () => ({ id: 'gw_1' });
    mockPrisma.paymentWebhook.create = (async () => {
      throw new Error('Banco de dados indisponível');
    }) as never;

    const { POST } = await import('@/app/api/webhooks/asaas/route');
    const res = await POST(
      makeRequest(
        { id: 'evt_err', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_err' } },
        VALID_TOKEN,
      ) as never,
      { params: Promise.resolve({}) } as never,
    );

    assert.equal(res.status, 500);
  });
});
