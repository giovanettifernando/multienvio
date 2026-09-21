import assert from 'node:assert';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { AdminPermission } from '@prisma/client';
import { GET, POST } from '@/app/api/admin/staff/users/route';
import { prisma } from '@/platform/db/db';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as mailer from '@/platform/email/mailer';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const original = { staffUser: prisma.staffUser, staffRole: prisma.staffRole, $transaction: prisma.$transaction };

function registro(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    name: 'Ana',
    email: 'ana@empresa.com',
    phone: null,
    status: 'ACTIVE',
    isSuperAdmin: false,
    permissions: ['OPERACOES'],
    lastAccessAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  };
}

const listar = (qs = '') => callRoute(GET, apiRequest(`/api/admin/staff/users${qs}`));
const criar = (json: unknown) => callRoute(POST, apiRequest('/api/admin/staff/users', { json }));

const novo = { name: 'Bia', email: ' Bia@Empresa.com ', status: 'ACTIVE', permissions: ['SUPORTE'] };

test.describe('app/api/admin/staff/users', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['USUARIOS', 'SUPORTE'] })
    );
    test.mock.method(mailer, 'sendStaffTempPasswordEmail', async () => true);
    prisma.$transaction = (async (ops: Promise<unknown>[]) => Promise.all(ops)) as any;
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, original);
  });

  test('GET exige a permissão USUARIOS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['CONTAS'] })
    );
    const res = await readApi(await listar());
    assert.strictEqual(res.status, 403);
  });

  test('GET aplica busca, status e paginação no banco', async () => {
    let consulta: any;
    prisma.staffUser = {
      findMany: async (a: any) => { consulta = a; return [registro()]; },
      count: async () => 11,
    } as any;

    const res = await readApi(await listar('?q=ana&status=blocked&page=2&pageSize=5&sort=name_asc'));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(consulta.skip, 5);
    assert.strictEqual(consulta.take, 5);
    assert.deepStrictEqual(consulta.orderBy, { name: 'asc' });
    assert.deepStrictEqual(consulta.where.AND[1], { status: 'BLOCKED' });
    assert.strictEqual(consulta.select.passwordHash, undefined, 'hash da senha não pode sair do banco');
    assert.strictEqual(res.data.total, 11);
    assert.strictEqual(res.data.items[0].status, 'active');
    assert.deepStrictEqual(res.data.users, [{ id: 'u1', name: 'Ana', email: 'ana@empresa.com' }]);
  });

  test('GET mostra super admin com todas as permissões', async () => {
    prisma.staffUser = {
      findMany: async () => [registro({ isSuperAdmin: true, permissions: [] })],
      count: async () => 1,
    } as any;
    const res = await readApi(await listar());
    assert.deepStrictEqual([...res.data.items[0].permissions].sort(), Object.values(AdminPermission).sort());
  });

  test('POST recusa e-mail já cadastrado', async () => {
    prisma.staffUser = { findUnique: async () => registro() } as any;
    const res = await readApi(await criar(novo));
    assert.strictEqual(res.status, 409);
  });

  test('POST exige ao menos uma permissão para staff comum', async () => {
    prisma.staffUser = { findUnique: async () => null } as any;
    const res = await readApi(await criar({ ...novo, permissions: [] }));
    assert.strictEqual(res.status, 400);
  });

  test('POST cria com senha temporária guardada só como hash e manda por e-mail', async () => {
    let dados: any;
    prisma.staffUser = {
      findUnique: async () => null,
      create: async (a: any) => { dados = a.data; return registro({ ...a.data, id: 'u2' }); },
    } as any;
    prisma.staffRole = { findFirst: async () => ({ id: 'role-operator' }) } as any;

    const res = await readApi(await criar(novo));

    assert.strictEqual(res.status, 201);
    assert.strictEqual(dados.email, 'bia@empresa.com');
    assert.strictEqual(dados.roleId, 'role-operator');
    assert.strictEqual(res.data.passwordGenerated, true);
    assert.strictEqual(res.data.user.passwordHash, undefined);

    const [, , senha] = (mailer.sendStaffTempPasswordEmail as any).mock.calls[0].arguments;
    assert.notStrictEqual(dados.passwordHash, senha);
    assert.ok(await bcrypt.compare(senha, dados.passwordHash));
  });

  test('POST responde 500 quando não há papel de staff cadastrado', async () => {
    prisma.staffUser = { findUnique: async () => null } as any;
    prisma.staffRole = { findFirst: async () => null } as any;
    const res = await readApi(await criar(novo));
    assert.strictEqual(res.status, 500);
  });

  test('POST: só super admin cria super admin', async () => {
    const criou = { n: 0 };
    prisma.staffUser = { findUnique: async () => null, create: async () => { criou.n++; return registro(); } } as any;
    const res = await readApi(await criar({ ...novo, isSuperAdmin: true }));
    assert.strictEqual(res.status, 403);
    assert.strictEqual(criou.n, 0);
  });

  test('POST: não cria conta com permissão que o gestor não tem', async () => {
    prisma.staffUser = { findUnique: async () => null, create: async () => registro() } as any;
    const res = await readApi(await criar({ ...novo, permissions: ['SUPORTE', 'FINANCEIRO'] }));
    assert.strictEqual(res.status, 403);
    assert.match(res.error.message, /FINANCEIRO/);
  });
});
