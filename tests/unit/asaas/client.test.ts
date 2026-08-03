import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { AsaasApiError } from '@/platform/integrations/asaas/types';

// client.ts -> config.ts -> @/platform/db/db, que faz `import 'server-only'` e
// inicializa conexão real com o banco no escopo do módulo. Sob node --test
// (CommonJS puro, fora do bundler do Next.js) isso lança/quebra no import.
// Mesmo padrão de stub já usado em tests/unit/platform/integrations/pagarme/client.test.ts.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const CLIENT_PATH = path.resolve(ROOT, 'platform/integrations/asaas/client.ts');

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: {} } } as any;
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
}

before(() => {
  stubModules();
  delete require.cache[CLIENT_PATH];
});

function loadAsaasRequest() {
  return (req(CLIENT_PATH) as typeof import('../../../platform/integrations/asaas/client')).asaasRequest;
}

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
    const asaasRequest = loadAsaasRequest();
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
    const asaasRequest = loadAsaasRequest();
    const { impl } = fakeFetch(200, {});
    await assert.rejects(
      () => asaasRequest('/v3/customers', {}, { getConfig: async () => null, fetchImpl: impl }),
      (err: unknown) => err instanceof AsaasApiError && err.code === 'NOT_CONFIGURED',
    );
  });

  it('extrai a descrição do erro do corpo da resposta', async () => {
    const asaasRequest = loadAsaasRequest();
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
    const asaasRequest = loadAsaasRequest();
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
