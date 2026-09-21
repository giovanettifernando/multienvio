import assert from 'node:assert';
import test from 'node:test';
import { PATCH } from '@/app/api/admin/staff/users/[id]/status/route';
import { prisma } from '@/platform/db/db';
import { staffSessionCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../../../_setup/test-helpers';

const originalStaffUser = prisma.staffUser;

const mudarStatus = (status: string) =>
  callRoute(PATCH, apiRequest('/api/admin/staff/users/alvo/status', { method: 'PATCH', json: { status } }), { id: 'alvo' });

test.describe('app/api/admin/staff/users/[id]/status', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['USUARIOS'] })
    );
    test.mock.method(staffSessionCache, 'incrementTokenVersion', async () => 2);
    prisma.staffUser = {
      findUnique: async () => ({ id: 'alvo', isSuperAdmin: false }),
      update: async (a: any) => ({
        id: 'alvo', name: 'Alvo', email: 'alvo@empresa.com', phone: null,
        status: a.data.status, isSuperAdmin: false, permissions: ['SUPORTE'],
        lastAccessAt: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
      }),
    } as any;
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.staffUser = originalStaffUser;
  });

  test('exige a permissão USUARIOS', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['SUPORTE'] })
    );
    const res = await readApi(await mudarStatus('BLOCKED'));
    assert.strictEqual(res.status, 403);
  });

  test('bloquear derruba na hora a sessão do staff', async () => {
    const res = await readApi(await mudarStatus('BLOCKED'));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.status, 'blocked');
    const revogou = (staffSessionCache.incrementTokenVersion as any).mock.calls;
    assert.strictEqual(revogou.length, 1, 'staff bloqueado não pode seguir logado');
    assert.strictEqual(revogou[0].arguments[0], 'alvo');
  });

  test('não bloqueia o próprio acesso', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ staffId: 'alvo', permissions: ['USUARIOS'] })
    );
    const res = await readApi(await mudarStatus('BLOCKED'));
    assert.strictEqual(res.status, 403);
  });

  test('staff comum não bloqueia super admin', async () => {
    (prisma.staffUser as any).findUnique = async () => ({ id: 'alvo', isSuperAdmin: true });
    const res = await readApi(await mudarStatus('BLOCKED'));
    assert.strictEqual(res.status, 403);
    assert.strictEqual((staffSessionCache.incrementTokenVersion as any).mock.callCount(), 0);
  });
});
