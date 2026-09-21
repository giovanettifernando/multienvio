import assert from 'node:assert';
import test from 'node:test';
import { AdminPermission } from '@prisma/client';
import { GET } from '@/app/api/admin/auth/me/route';
import { prisma } from '@/platform/db/db';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const originalStaffUser = prisma.staffUser;

function staff(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    name: 'Staff',
    email: 'staff@empresa.com',
    status: 'ACTIVE',
    isSuperAdmin: false,
    permissions: ['OPERACOES', 'SUPORTE'],
    role: { name: 'operator' },
    lastLoginAt: new Date(),
    lastAccessAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const me = () => callRoute(GET, apiRequest('/api/admin/auth/me'));

test.describe('app/api/admin/auth/me', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.staffUser = originalStaffUser;
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await readApi(await me());
    assert.strictEqual(res.status, 401);
  });

  test('responde 404 quando o staff foi removido', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession());
    prisma.staffUser = { findUnique: async () => null } as any;
    const res = await readApi(await me());
    assert.strictEqual(res.status, 404);
  });

  test('responde 403 quando o staff foi bloqueado depois do login', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession());
    prisma.staffUser = { findUnique: async () => staff({ status: 'BLOCKED' }) } as any;
    const res = await readApi(await me());
    assert.strictEqual(res.status, 403);
  });

  test('devolve o staff da sessão com as permissões do banco', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession({ staffId: 's1' }));
    let buscado: any;
    prisma.staffUser = { findUnique: async (a: any) => { buscado = a.where; return staff(); } } as any;

    const res = await readApi(await me());

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(buscado, { id: 's1' });
    assert.deepStrictEqual(res.data.staff.permissions, ['OPERACOES', 'SUPORTE']);
    assert.strictEqual(res.data.staff.lastAccessAt, null);
  });

  test('super admin aparece com todas as permissões', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () => adminSession());
    prisma.staffUser = { findUnique: async () => staff({ isSuperAdmin: true, permissions: [] }) } as any;

    const res = await readApi(await me());

    assert.deepStrictEqual([...res.data.staff.permissions].sort(), Object.values(AdminPermission).sort());
  });
});
