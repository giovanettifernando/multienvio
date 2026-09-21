import assert from 'node:assert';
import test from 'node:test';
import { GET, PUT } from '@/app/api/admin/staff/users/[id]/route';
import { prisma } from '@/platform/db/db';
import { staffSessionCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as audit from '@/platform/logging/audit-admin';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../../_setup/test-helpers';

const originalStaffUser = prisma.staffUser;

function registro(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alvo',
    name: 'Alvo',
    email: 'alvo@empresa.com',
    phone: null,
    status: 'ACTIVE',
    isSuperAdmin: false,
    permissions: ['OPERACOES', 'FINANCEIRO'],
    lastAccessAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const ver = () => callRoute(GET, apiRequest('/api/admin/staff/users/alvo'), { id: 'alvo' });
const editar = (json: unknown) =>
  callRoute(PUT, apiRequest('/api/admin/staff/users/alvo', { method: 'PUT', json }), { id: 'alvo' });

/** Banco em memória com um staff; `update` aplica os dados recebidos. */
function banco(existente = registro(), outros: Record<string, any> = {}) {
  const chamadas: any[] = [];
  prisma.staffUser = {
    findUnique: async (a: any) => (a.where.id === 'alvo' ? existente : outros[a.where.email] ?? null),
    update: async (a: any) => {
      chamadas.push(a.data);
      return { ...existente, ...a.data };
    },
  } as any;
  return chamadas;
}

test.describe('app/api/admin/staff/users/[id]', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['USUARIOS'] })
    );
    test.mock.method(staffSessionCache, 'incrementTokenVersion', async () => 2);
    test.mock.method(audit, 'logPermissionChange', async () => {});
    test.mock.method(audit, 'logStatusChange', async () => {});
    test.mock.method(audit, 'logAdminAction', async () => {});
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.staffUser = originalStaffUser;
  });

  const revogacoes = () => (staffSessionCache.incrementTokenVersion as any).mock.calls;

  test('GET exige a permissão USUARIOS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['OPERACOES'] })
    );
    const res = await readApi(await ver());
    assert.strictEqual(res.status, 403);
  });

  test('GET responde 404 para staff inexistente', async () => {
    prisma.staffUser = { findUnique: async () => null } as any;
    const res = await readApi(await ver());
    assert.strictEqual(res.status, 404);
  });

  test('GET devolve o staff com status legível', async () => {
    banco(registro({ status: 'BLOCKED' }));
    const res = await readApi(await ver());
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.status, 'blocked');
    assert.deepStrictEqual(res.data.user.permissions, ['OPERACOES', 'FINANCEIRO']);
  });

  test('PUT recusa e-mail que já pertence a outro staff', async () => {
    banco(registro(), { 'outro@empresa.com': registro({ id: 'outro' }) });
    const res = await readApi(await editar({ email: 'outro@empresa.com' }));
    assert.strictEqual(res.status, 409);
  });

  test('PUT não deixa um staff comum sem nenhuma permissão', async () => {
    banco();
    const res = await readApi(await editar({ permissions: [] }));
    assert.strictEqual(res.status, 400);
  });

  test('PUT de dados cadastrais não derruba a sessão', async () => {
    banco();
    const res = await readApi(await editar({ name: 'Novo Nome', phone: '11999999999' }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(revogacoes().length, 0);
  });

  test('retirar permissão audita e derruba a sessão na hora', async () => {
    banco();

    const res = await readApi(await editar({ permissions: ['OPERACOES'] }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      (audit.logPermissionChange as any).mock.calls[0].arguments,
      ['s1', 'alvo', [], ['FINANCEIRO']]
    );
    // A permissão vai gravada no token do login: sem revogar, a retirada só
    // valeria quando a sessão expirasse (7 dias).
    assert.strictEqual(revogacoes().length, 1);
    assert.strictEqual(revogacoes()[0].arguments[0], 'alvo');
  });

  test('bloquear pelo PUT audita e derruba a sessão na hora', async () => {
    banco();
    const res = await readApi(await editar({ status: 'BLOCKED' }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual((audit.logStatusChange as any).mock.callCount(), 1);
    assert.strictEqual(revogacoes().length, 1);
  });

  test('tirar o super admin audita e derruba a sessão', async () => {
    banco(registro({ isSuperAdmin: true, permissions: [] }));
    const res = await readApi(await editar({ isSuperAdmin: false, permissions: ['SUPORTE'] }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual((audit.logAdminAction as any).mock.calls[0].arguments[1], 'revoke_super_admin');
    assert.strictEqual(revogacoes().length, 1);
  });
});
