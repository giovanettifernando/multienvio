import { mock } from 'node:test';
import { NextRequest } from 'next/server';

// Ensure consistent test env
if (!process.env.NODE_ENV) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
}

export function resetAllMocks() {
  mock.restoreAll();
}

export function createMockedPrisma<T extends object>(target: T): T {
  return target;
}

/**
 * Utility to patch a method and return the spy for assertions.
 */
export function stubMethod<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  implementation: T[K]
) {
  return mock.method(obj, key as string, implementation as never);
}

/**
 * Tiny helper to advance timers in tests that rely on setTimeout.
 */
export async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Rotas de API (withApiHandler)
//
// Desde a refatoração da camada de API, toda rota recebe um NextRequest (o
// handler lê req.nextUrl) e um contexto com `params` como Promise, e responde
// no envelope { data, error, meta }. Estes helpers escondem esse protocolo
// para que os testes falem só de entrada e saída.
// ---------------------------------------------------------------------------


type RouteHandler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Monta um NextRequest; `json` vira corpo com Content-Type adequado. */
export function apiRequest(
  url: string,
  init: { method?: string; json?: unknown; headers?: Record<string, string>; body?: string } = {}
): NextRequest {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  return new NextRequest(url.startsWith('http') ? url : `http://test${url}`, {
    method: init.method ?? (body !== undefined ? 'POST' : 'GET'),
    headers,
    body,
  });
}

/** Chama a rota como o Next chamaria. */
export async function callRoute(
  handler: RouteHandler,
  req: NextRequest,
  params: Record<string, string> = {}
): Promise<Response> {
  return handler(req, { params: Promise.resolve(params) });
}

export type ApiResult<T = any> = {
  status: number;
  data: T;
  error: { code: string; message: string; details?: unknown } | null;
  body: any;
};

/** Lê o envelope { data, error, meta } de uma resposta. */
export async function readApi<T = any>(res: Response): Promise<ApiResult<T>> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return {
    status: res.status,
    data: body?.data ?? null,
    error: body?.error ?? null,
    body,
  };
}

// ---------------------------------------------------------------------------
// Sessão de admin
// ---------------------------------------------------------------------------

/** Sessão de staff como o JWT do painel a carrega. */
export function adminSession(overrides: Record<string, unknown> = {}) {
  return {
    staffId: 's1',
    email: 'staff@empresa.com',
    role: 'operator',
    isSuperAdmin: false,
    permissions: [] as string[],
    tokenVersion: 1,
    ...overrides,
  };
}
