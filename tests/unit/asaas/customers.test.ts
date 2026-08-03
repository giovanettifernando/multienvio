import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// customers.ts -> client.ts -> 'server-only', e client.ts -> config.ts -> @/platform/db/db
// (conexão real com o banco no escopo do módulo). Sob node --test (CommonJS puro,
// fora do bundler do Next.js) isso lança/quebra no import. Mesmo padrão de stub
// já usado em tests/unit/asaas/client.test.ts (Task 2).
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const CUSTOMERS_PATH = path.resolve(ROOT, 'platform/integrations/asaas/customers.ts');

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
  delete require.cache[CUSTOMERS_PATH];
});

function loadGetOrCreateCustomer() {
  return (req(CUSTOMERS_PATH) as typeof import('../../../platform/integrations/asaas/customers'))
    .getOrCreateCustomer;
}

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

    const getOrCreateCustomer = loadGetOrCreateCustomer();
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

    const getOrCreateCustomer = loadGetOrCreateCustomer();
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

    const getOrCreateCustomer = loadGetOrCreateCustomer();
    const customer = await getOrCreateCustomer({ name: 'João', email: 'joao@teste.com' }, { request });

    assert.equal(customer.id, 'cus_sem_doc');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, { name: 'João', email: 'joao@teste.com' });
  });
});
