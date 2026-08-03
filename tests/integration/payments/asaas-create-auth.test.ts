import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// A rota -> withApiHandler -> errors.ts -> @/platform/db/db, e a rota também importa
// @/platform/integrations/asaas (config.ts, client.ts, cards.ts, tracking.ts etc.), que
// puxam 'server-only' e @/platform/db/db no escopo do módulo. Sob node --test
// (CommonJS puro, fora do bundler do Next.js) isso lança/quebra no import estático.
// Mesmo padrão de stub já usado em tests/unit/asaas/tracking.test.ts (Task 7).
//
// getSession() real chama cookies() de 'next/headers', que só funciona dentro do
// request-scope do runtime do Next.js — fora dele (aqui, sob node --test puro)
// lança. Por isso mockamos getSession via node:test, mesmo padrão já usado em
// tests/integration/shipments/divergences-auth.test.ts e tests/integration/cart/cart-api.test.ts.
//
// Tudo isso precisa acontecer ANTES do import estático de @/modules/auth/application/session
// (que puxa 'next/headers' e, transitivamente, 'server-only' via jwt-tokens.ts) — daí os
// stubs serem aplicados de forma síncrona no topo do módulo, e não dentro de um hook.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const ROUTE_PATH = path.resolve(ROOT, 'app/api/payments/asaas/create/route.ts');
const SESSION_PATH = path.resolve(ROOT, 'modules/auth/application/session.ts');

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
delete require.cache[SESSION_PATH];

// Referência ao módulo real (com os stubs acima já em vigor) para poder mockar
// getSession com node:test — mesma instância que a rota usa internamente, pois
// ambos resolvem o mesmo caminho absoluto e compartilham o require.cache.
const sessionModule = req(SESSION_PATH) as typeof import('@/modules/auth/application/session');

afterEach(() => mock.restoreAll());

// withApiHandler lê req.nextUrl (específico de NextRequest) antes mesmo de chamar
// o handler da rota — um Request "puro" (Web Fetch API) não tem essa propriedade.
// Mesmo padrão de tests/unit/api/handler.test.ts (mockRequest com nextUrl).
function withNextUrl(request: Request): Request {
  (request as unknown as { nextUrl: URL }).nextUrl = new URL(request.url);
  return request;
}

describe('POST /api/payments/asaas/create', () => {
  it('exige autenticação', async () => {
    mock.method(sessionModule, 'getSession', async () => null);
    const { POST } = await import('@/app/api/payments/asaas/create/route');
    const req = withNextUrl(new Request('http://localhost/api/payments/asaas/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 4990,
        description: 'Envio',
        paymentMethod: 'pix',
        metadata: { type: 'checkout_payment' },
      }),
    }));

    const res = await POST(req as never, { params: Promise.resolve({}) } as never);
    assert.equal(res.status, 401);
  });

  it('rejeita método de pagamento desconhecido', async () => {
    // Sessão válida para a requisição alcançar a validação Zod — sem isso, o guard
    // de autenticação dispara primeiro e o teste "passa" sem exercitar o schema
    // (foi exatamente esse buraco que a revisão apontou na versão anterior deste teste).
    mock.method(sessionModule, 'getSession', async () => ({ userId: 'u_1' }) as never);

    const { POST } = await import('@/app/api/payments/asaas/create/route');
    const req = withNextUrl(new Request('http://localhost/api/payments/asaas/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 4990,
        description: 'Envio',
        paymentMethod: 'cheque',
        metadata: { type: 'checkout_payment' },
      }),
    }));

    const res = await POST(req as never, { params: Promise.resolve({}) } as never);
    // A rota valida o corpo com Zod ANTES de tocar em prisma/Asaas (createPaymentSchema.safeParse
    // roda logo após o guard de sessão), então nenhum stub de prisma é necessário aqui — a
    // requisição nunca chega lá. ApiError.validation() usa status 422 (não 400): é o código real
    // que platform/api/errors.ts atribui a erros de validação Zod nesta base de código.
    assert.equal(res.status, 422);
  });
});
