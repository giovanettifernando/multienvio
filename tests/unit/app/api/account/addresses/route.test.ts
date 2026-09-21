import assert from 'node:assert';
import test from 'node:test';
import { GET, POST } from '@/app/api/account/addresses/route';
import { prisma } from '@/platform/db/db';

const originalAddress = prisma.address;

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

test.describe('app/api/account/addresses', () => {
  let sessionModule: any;
  let addressSchemaModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../modules/auth/application/session.ts');
    addressSchemaModule = await import('../../../../../../shared/validation/address.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.address = originalAddress;
  });

  test('GET retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await GET(makeRequest('http://test/api/account/addresses'));
    assert.strictEqual(res.status, 401);
  });

  test('GET retorna endereços do usuário', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    prisma.address = {
      findMany: async () => [{ id: 'a1', label: 'Casa', cep: '123', logradouro: 'Rua', numero: '1', complemento: null, bairro: 'B', cidade: 'C', uf: 'SP', isDefault: true, createdAt: new Date(), updatedAt: new Date() }],
    } as any;
    const res = await GET(makeRequest('http://test/api/account/addresses'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.addresses[0].id, 'a1');
  });

  test('POST retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await POST(makeRequest('http://test/api/account/addresses', { method: 'POST' }));
    assert.strictEqual(res.status, 401);
  });

  test('POST retorna 400 em validação Zod', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    test.mock.method(addressSchemaModule.AddressSchema, 'parse', () => {
      const err: any = { issues: [{ path: ['cep'], message: 'CEP inválido' }] };
      err.issues = err.issues;
      throw err;
    });
    const res = await POST(
      makeRequest('http://test/api/account/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'VALIDATION_ERROR');
  });

  test('POST cria endereço e redefine default', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    test.mock.method(addressSchemaModule.AddressSchema, 'parse', () => ({
      label: 'Casa',
      cep: '12345678',
      logradouro: 'Rua',
      numero: '10',
      complemento: null,
      bairro: 'Centro',
      cidade: 'Cidade',
      uf: 'SP',
      isDefault: true,
    }));
    let updateManyCalled = false;
    prisma.address = {
      updateMany: async () => {
        updateManyCalled = true;
        return {};
      },
      create: async ({ data }: any) => ({ id: 'a1', createdAt: new Date(), updatedAt: new Date(), ...data }),
    } as any;
    const res = await POST(
      makeRequest('http://test/api/account/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.address.id, 'a1');
    assert.ok(updateManyCalled);
  });
});
