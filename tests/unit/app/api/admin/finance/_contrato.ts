/**
 * Contrato comum das rotas de /api/admin/finance: só staff com FINANCEIRO entra,
 * ações de escrita têm limite por usuário e corpo validado.
 *
 * A maioria destas rotas ainda é esqueleto herdado do Envio Legal (responde ok
 * sem gravar) e nenhuma tela montada as chama; os testes cobrem o controle de acesso.
 */
import assert from 'node:assert';
import test from 'node:test';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as rateLimit from '@/platform/cache/rate-limit-redis';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

type Handler = (req: any, ctx: any) => Promise<Response>;

interface Rota {
  nome: string;
  handler: Handler;
  url: string;
  method?: 'GET' | 'POST';
  params?: Record<string, string>;
  /** corpo válido (rotas de escrita) */
  corpo?: unknown;
  /** corpo que a validação precisa recusar */
  corpoInvalido?: unknown;
  /** a rota consulta o limite por usuário */
  limitada?: boolean;
  /** confere a resposta de sucesso */
  sucesso?: (res: Awaited<ReturnType<typeof readApi>>) => void;
}

export function comoFinanceiro() {
  test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
    adminSession({ permissions: ['FINANCEIRO'] })
  );
}

export function chamar(r: Rota, corpo = r.corpo) {
  const method = r.method ?? (r.corpo !== undefined ? 'POST' : 'GET');
  return callRoute(r.handler, apiRequest(r.url, { method, json: corpo }), r.params ?? {});
}

export function contratoFinanceiro(r: Rota) {
  test.describe(r.nome, () => {
    test.beforeEach(() => {
      test.mock.method(rateLimit, 'rateLimitByUser', async () => null);
    });

    test.afterEach(() => {
      test.mock.restoreAll();
    });

    test('responde 401 sem sessão', async () => {
      test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
      const res = await readApi(await chamar(r));
      assert.strictEqual(res.status, 401);
    });

    test('responde 403 sem a permissão FINANCEIRO', async () => {
      test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
        adminSession({ permissions: ['CONTAS', 'OPERACOES'] })
      );
      const res = await readApi(await chamar(r));
      assert.strictEqual(res.status, 403);
    });

    if (r.limitada) {
      test('responde 429 quando o limite estoura', async () => {
        comoFinanceiro();
        test.mock.method(rateLimit, 'rateLimitByUser', async () => Response.json({}, { status: 429 }));
        const res = await readApi(await chamar(r));
        assert.strictEqual(res.status, 429);
      });
    }

    if (r.corpoInvalido !== undefined) {
      test('responde 400 para corpo inválido', async () => {
        comoFinanceiro();
        const res = await readApi(await chamar(r, r.corpoInvalido));
        assert.strictEqual(res.status, 400);
      });
    }

    test('responde 200 para staff do financeiro', async () => {
      comoFinanceiro();
      const res = await readApi(await chamar(r));
      assert.strictEqual(res.status, 200);
      r.sucesso?.(res);
    });
  });
}

export const listaVazia = (page = 1, pageSize = 10) => (res: { data: any }) =>
  assert.deepStrictEqual(res.data, { items: [], page, pageSize, total: 0 });

export const ok = (res: { data: any }) => assert.strictEqual(res.data.ok, true);
