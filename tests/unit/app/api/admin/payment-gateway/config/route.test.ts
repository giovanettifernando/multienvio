import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/admin/payment-gateway/config/route';
import { prisma } from '@/platform/db/db';

const originalGateway = prisma.paymentGateway;
const originalCredential = prisma.paymentCredential;

function makeRequest(body?: unknown, method: 'GET' | 'POST' = 'GET') {
  return new Request('http://test/api/admin/payment-gateway/config', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : undefined,
  });
}

test.describe('app/api/admin/payment-gateway/config', () => {
  let adminHelpers: any;
  let encryptModule: any;

  test.before(async () => {
    adminHelpers = await import('../../../../../../../lib/auth/admin-helpers.ts');
    encryptModule = await import('../../../../../../../lib/integrations/shared/encryption.service.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.paymentGateway = originalGateway;
    prisma.paymentCredential = originalCredential;
  });

  test('GET retorna resposta de auth quando bloqueado', async () => {
    test.mock.method(
      adminHelpers,
      'requireAdminUser',
      async () => NextResponse.json({ message: 'nope' }, { status: 401 })
    );

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 401);
  });

  test('GET retorna config null quando não há credencial', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentGateway = {
      findFirst: async () => ({ id: 'g1', credentials: [] }),
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { config: null });
  });

  test('GET retorna publicKey e environment quando configurado', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentGateway = {
      findFirst: async () => ({
        id: 'g1',
        environment: 'sandbox',
        credentials: [{ publicKey: 'pub123', createdAt: new Date() }],
      }),
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.config.environment, 'sandbox');
    assert.strictEqual(body.config.publicKey, 'pub123');
    assert.strictEqual(body.config.accessToken, undefined);
  });

  test('GET retorna 500 em erro inesperado', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentGateway = {
      findFirst: async () => {
        throw new Error('boom');
      },
    } as any;

    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 500);
  });

  test('POST retorna auth block quando require falha', async () => {
    test.mock.method(
      adminHelpers,
      'requireAdminUser',
      async () => NextResponse.json({ message: 'denied' }, { status: 401 })
    );

    const res = await POST(makeRequest({}, 'POST'));
    assert.strictEqual(res.status, 401);
  });

  test('POST valida environment/publicKey', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));

    const res = await POST(makeRequest({ environment: '', publicKey: '' }, 'POST'));
    assert.strictEqual(res.status, 400);
  });

  test('POST cria gateway e credencial quando não existe', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    const encryptSpy = test.mock.method(encryptModule, 'encrypt', (value: string) => `enc(${value})`);

    prisma.paymentGateway = {
      findFirst: async () => null,
      create: async () => ({ id: 'g1', environment: 'sandbox' }),
      update: async () => {
        throw new Error('should not update');
      },
    } as any;
    prisma.paymentCredential = {
      findFirst: async () => null,
      create: async (args: any) => ({
        id: 'c1',
        ...args.data,
      }),
    } as any;

    const res = await POST(
      makeRequest(
        { environment: 'sandbox', publicKey: 'pub', accessToken: 'tok', webhookSecret: 'sec' },
        'POST'
      )
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(encryptSpy.mock.callCount(), 2);
  });

  test('POST atualiza gateway e credencial existente', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    test.mock.method(encryptModule, 'encrypt', (value: string) => `enc(${value})`);

    let updateGatewayCalled = false;
    let updateCredentialCalled = false;

    prisma.paymentGateway = {
      findFirst: async () => ({ id: 'g2', environment: 'production' }),
      create: async () => {
        throw new Error('should not create');
      },
      update: async () => {
        updateGatewayCalled = true;
        return { id: 'g2', environment: 'sandbox' };
      },
    } as any;
    prisma.paymentCredential = {
      findFirst: async () => ({ id: 'cred1', isActive: true }),
      update: async () => {
        updateCredentialCalled = true;
        return { id: 'cred1' };
      },
      create: async () => {
        throw new Error('should not create credential');
      },
    } as any;

    const res = await POST(
      makeRequest({ environment: 'sandbox', publicKey: 'pub2', accessToken: 'tok2' }, 'POST')
    );
    assert.strictEqual(res.status, 200);
    assert.ok(updateGatewayCalled);
    assert.ok(updateCredentialCalled);
  });

  test('POST retorna 500 em erro inesperado', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => ({ staffId: 's1' }));
    prisma.paymentGateway = {
      findFirst: async () => {
        throw new Error('db fail');
      },
    } as any;

    const res = await POST(makeRequest({ environment: 'sandbox', publicKey: 'p' }, 'POST'));
    assert.strictEqual(res.status, 500);
  });
});
