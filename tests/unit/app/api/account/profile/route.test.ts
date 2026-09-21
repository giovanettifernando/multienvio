import assert from 'node:assert';
import test from 'node:test';
import { GET, PUT } from '@/app/api/account/profile/route';
import { prisma } from '@/platform/db/db';
import { userCache } from '@/platform/cache/cache';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const originalPrismaUser = prisma.user;

const usuarioComEmpresa = {
  name: 'User',
  email: 'a@b.com',
  phone: '11987654321',
  cpf: '52998224725',
  avatarUrl: null,
  hasCompany: true,
  cnpj: '11222333000181',
  razaoSocial: 'Empresa LTDA',
};

test.describe('app/api/account/profile', () => {
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

  test('GET retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await callRoute(GET, apiRequest('/api/account/profile')));
    assert.strictEqual(res.status, 401);
  });

  test('GET retorna 404 quando o usuário não existe', async () => {
    logado();
    prisma.user = { findUnique: async () => null } as any;
    const res = await readApi(await callRoute(GET, apiRequest('/api/account/profile')));
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.error?.code, 'not_found');
  });

  test('GET converte o usuário no formato de perfil da tela', async () => {
    logado();
    prisma.user = { findUnique: async () => usuarioComEmpresa } as any;

    const res = await readApi(await callRoute(GET, apiRequest('/api/account/profile')));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.fullName, 'User');
    assert.strictEqual(res.data.email, 'a@b.com');
    assert.deepStrictEqual(res.data.company, { cnpj: '11222333000181', razaoSocial: 'Empresa LTDA' });
  });

  test('GET não devolve empresa quando o usuário não tem', async () => {
    logado();
    prisma.user = {
      findUnique: async () => ({ ...usuarioComEmpresa, hasCompany: false, cnpj: null, razaoSocial: null }),
    } as any;

    const res = await readApi(await callRoute(GET, apiRequest('/api/account/profile')));

    assert.strictEqual(res.data.company, null);
    assert.strictEqual(res.data.hasCompany, false);
  });

  test('PUT recusa CPF inválido sem gravar nada', async () => {
    logado();
    let gravou = false;
    prisma.user = { update: async () => { gravou = true; return usuarioComEmpresa; } } as any;

    const res = await readApi(
      await callRoute(PUT, apiRequest('/api/account/profile', { method: 'PUT', json: { fullName: 'User', cpf: '11111111111' } }))
    );

    assert.strictEqual(res.status, 400);
    assert.match(res.error!.message, /CPF/);
    assert.strictEqual(gravou, false);
  });

  test('PUT traduz o formulário para o banco e devolve o perfil salvo', async () => {
    logado();
    const invalidou = test.mock.method(userCache, 'invalidate', async () => true);
    let dados: any;
    prisma.user = {
      update: async (args: any) => {
        dados = args.data;
        return { ...usuarioComEmpresa, ...args.data };
      },
    } as any;

    const res = await readApi(
      await callRoute(
        PUT,
        apiRequest('/api/account/profile', {
          method: 'PUT',
          json: {
            fullName: '  Nome   Novo ',
            cpf: '529.982.247-25',
            hasCompany: true,
            company: { cnpj: '11222333000181', razaoSocial: 'Empresa LTDA' },
          },
        })
      )
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(dados.name, 'Nome Novo', 'nome deveria ser aparado e sem espaços duplos');
    assert.strictEqual(dados.cpf, '52998224725', 'CPF deveria ser gravado sem máscara');
    assert.strictEqual(dados.cnpj, '11222333000181');
    assert.strictEqual(res.data.fullName, 'Nome Novo');
    assert.strictEqual(invalidou.mock.callCount(), 1);
  });
});
