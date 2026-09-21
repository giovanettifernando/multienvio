import assert from 'node:assert';
import test from 'node:test';
import { GET, PUT } from '@/app/api/account/me/route';
import { prisma } from '@/platform/db/db';
import { userCache } from '@/platform/cache/cache';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const originalPrismaUser = prisma.user;

const usuario = {
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
};

test.describe('app/api/account/me', () => {
  let sessionModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../modules/auth/application/session.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalPrismaUser;
  });

  const logado = () =>
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));

  test('GET retorna 401 quando não autenticado', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await callRoute(GET, apiRequest('/api/account/me')));
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.error?.code, 'unauthorized');
  });

  test('GET retorna 404 quando o usuário não existe mais', async () => {
    logado();
    prisma.user = { findUnique: async () => null } as any;
    const res = await readApi(await callRoute(GET, apiRequest('/api/account/me')));
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.error?.code, 'not_found');
  });

  test('GET retorna o próprio usuário, com datas em ISO', async () => {
    logado();
    let buscado: any;
    prisma.user = {
      findUnique: async (args: any) => {
        buscado = args.where;
        return usuario;
      },
    } as any;

    const res = await readApi(await callRoute(GET, apiRequest('/api/account/me')));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(buscado, { id: 'u1' });
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.id, 'u1');
    assert.strictEqual(typeof res.data.user.createdAt, 'string');
  });

  test('PUT recusa troca de e-mail', async () => {
    logado();
    let atualizou = false;
    prisma.user = { update: async () => { atualizou = true; return usuario; } } as any;

    const res = await readApi(
      await callRoute(PUT, apiRequest('/api/account/me', { method: 'PUT', json: { email: 'novo@example.com' } }))
    );

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error?.code, 'email_immutable');
    assert.strictEqual(atualizou, false);
  });

  test('PUT atualiza o perfil e invalida o cache do usuário', async () => {
    logado();
    const invalidou = test.mock.method(userCache, 'invalidate', async () => true);
    let where: any;
    prisma.user = {
      update: async (args: any) => {
        where = args.where;
        return { ...usuario, ...args.data };
      },
    } as any;

    const res = await readApi(
      await callRoute(
        PUT,
        apiRequest('/api/account/me', {
          method: 'PUT',
          json: { name: 'User Name', phone: null, cpf: null, avatarUrl: null, hasCompany: false },
        })
      )
    );

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(where, { id: 'u1' }, 'só pode atualizar o próprio usuário');
    assert.strictEqual(res.data.user.name, 'User Name');
    assert.strictEqual(invalidou.mock.callCount(), 1);
  });
});
