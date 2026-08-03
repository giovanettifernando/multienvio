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

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = {
    id: DB_PATH,
    filename: DB_PATH,
    loaded: true,
    exports: {
      prisma: {},
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
