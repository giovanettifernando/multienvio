import assert from 'node:assert';
import test from 'node:test';
import { GET, PUT } from '@/app/api/account/me/route';
import { prisma } from '@/platform/db/db';

const originalPrismaUser = prisma.user;

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

test.describe('app/api/account/me', () => {
  let sessionModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../modules/auth/application/session.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalPrismaUser;
  });

  test('GET retorna 401 quando não autenticado', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await GET(makeRequest('http://test/api/account/me'));
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'UNAUTHORIZED');
  });

  test('GET retorna 404 quando usuário não existe', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    prisma.user = { findUnique: async () => null } as any;
    const res = await GET(makeRequest('http://test/api/account/me'));
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.code, 'USER_NOT_FOUND');
  });

  test('GET retorna usuário quando autenticado', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    prisma.user = {
      findUnique: async () => ({
        id: 'u1',
        name: 'User',
        email: 'a@b.com',
        phone: null,
        cpf: null,
        avatarUrl: null,
        hasCompany: false,
        cnpj: null,
        razaoSocial: null,
        status: 'ACTIVE',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;

    const res = await GET(makeRequest('http://test/api/account/me'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.id, 'u1');
  });

  test('PUT rejeita alteração de email', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    const res = await PUT(
      makeRequest('http://test/api/account/me', {
        method: 'PUT',
        body: JSON.stringify({ email: 'new@example.com' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'EMAIL_IMMUTABLE');
  });

  test('PUT atualiza dados válidos', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    prisma.user = {
      update: async ({ data }: any) => ({
        id: 'u1',
        email: 'a@b.com',
        status: 'ACTIVE',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }),
    } as any;

    const res = await PUT(
      makeRequest('http://test/api/account/me', {
        method: 'PUT',
        body: JSON.stringify({ name: 'User Name', phone: null, cpf: null, avatarUrl: null, hasCompany: false }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.name, 'User Name');
  });
});
