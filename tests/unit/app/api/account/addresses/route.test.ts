import assert from 'node:assert';
import test from 'node:test';
import { GET, POST } from '@/app/api/account/addresses/route';
import { prisma } from '@/platform/db/db';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const originalAddress = prisma.address;

const enderecoValido = {
  label: 'Casa',
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  complemento: null,
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP',
  isDefault: true,
};

test.describe('app/api/account/addresses', () => {
  let sessionModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../modules/auth/application/session.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.address = originalAddress;
  });

  const logado = () =>
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));

  test('GET retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await callRoute(GET, apiRequest('/api/account/addresses')));
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.error?.code, 'unauthorized');
  });

  test('GET lista só os endereços do usuário, sem cache no navegador', async () => {
    logado();
    let filtro: any;
    prisma.address = {
      findMany: async (args: any) => {
        filtro = args.where;
        return [{ id: 'a1', label: 'Casa', cep: '01310100', logradouro: 'Rua', numero: '1', complemento: null, bairro: 'B', cidade: 'C', uf: 'SP', isDefault: true, createdAt: new Date(), updatedAt: new Date() }];
      },
    } as any;

    const raw = await callRoute(GET, apiRequest('/api/account/addresses'));
    const res = await readApi(raw);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(filtro, { userId: 'u1' });
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.addresses[0].id, 'a1');
    assert.strictEqual(typeof res.data.addresses[0].createdAt, 'string');
    assert.strictEqual(raw.headers.get('cache-control'), 'no-store');
  });

  test('POST retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await callRoute(POST, apiRequest('/api/account/addresses', { json: enderecoValido })));
    assert.strictEqual(res.status, 401);
  });

  test('POST retorna 400 quando o endereço é inválido', async () => {
    logado();
    const res = await readApi(
      await callRoute(POST, apiRequest('/api/account/addresses', { json: { ...enderecoValido, cep: '123' } }))
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error?.code, 'validation_error');
    assert.match(res.error!.message, /CEP/);
  });

  test('POST cria o endereço e desmarca o padrão anterior', async () => {
    logado();
    let desmarcou = false;
    let criado: any;
    prisma.address = {
      updateMany: async (args: any) => {
        desmarcou = args.where.userId === 'u1' && args.data.isDefault === false;
        return { count: 1 };
      },
      create: async ({ data }: any) => {
        criado = data;
        return { id: 'a1', createdAt: new Date(), updatedAt: new Date(), ...data };
      },
    } as any;

    const res = await readApi(await callRoute(POST, apiRequest('/api/account/addresses', { json: enderecoValido })));

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.address.id, 'a1');
    assert.ok(desmarcou, 'deveria desmarcar o endereço padrão anterior');
    assert.strictEqual(criado.cep, '01310100', 'CEP deveria ser gravado sem máscara');
    assert.strictEqual(criado.userId, 'u1');
  });

  test('POST não mexe no padrão anterior quando o novo não é padrão', async () => {
    logado();
    let desmarcou = false;
    prisma.address = {
      updateMany: async () => {
        desmarcou = true;
        return { count: 0 };
      },
      create: async ({ data }: any) => ({ id: 'a2', createdAt: new Date(), updatedAt: new Date(), ...data }),
    } as any;

    const res = await readApi(
      await callRoute(POST, apiRequest('/api/account/addresses', { json: { ...enderecoValido, isDefault: false } }))
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(desmarcou, false);
  });
});
