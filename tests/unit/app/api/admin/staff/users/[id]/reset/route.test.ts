import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/staff/users/[id]/reset/route';
import { prisma } from '@/platform/db/db';
import { staffSessionCache } from '@/platform/cache/cache';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import * as audit from '@/platform/logging/audit-admin';
import * as rateLimit from '@/platform/cache/rate-limit-redis';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../../../_setup/test-helpers';

const originalStaffUser = prisma.staffUser;
const resetar = () =>
  callRoute(POST, apiRequest('/api/admin/staff/users/alvo/reset', { method: 'POST' }), { id: 'alvo' });

function banco(alvo: Record<string, unknown> | null) {
  const gravou = { n: 0 };
  prisma.staffUser = {
    findUnique: async () => alvo,
    update: async () => { gravou.n++; return alvo; },
  } as any;
  return gravou;
}

test.describe('app/api/admin/staff/users/[id]/reset', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['USUARIOS'] })
    );
    test.mock.method(rateLimit, 'rateLimitByUser', async () => null);
    test.mock.method(staffSessionCache, 'incrementTokenVersion', async () => 2);
    test.mock.method(audit, 'logPasswordReset', async () => {});
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.staffUser = originalStaffUser;
  });

  test('responde 404 para staff inexistente', async () => {
    banco(null);
    const res = await readApi(await resetar());
    assert.strictEqual(res.status, 404);
  });

  test('staff comum não redefine a senha de super admin', async () => {
    // A senha temporária volta para quem pediu: seria entrar como o super admin.
    const gravou = banco({ id: 'alvo', email: 'sa@empresa.com', isSuperAdmin: true });
    const res = await readApi(await resetar());
    assert.strictEqual(res.status, 403);
    assert.strictEqual(gravou.n, 0);
  });

  test('redefine a senha de staff comum e derruba as sessões dele', async () => {
    const gravou = banco({ id: 'alvo', email: 'x@empresa.com', isSuperAdmin: false });
    const res = await readApi(await resetar());
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.tempPassword);
    assert.strictEqual(gravou.n, 1);
    assert.strictEqual((staffSessionCache.incrementTokenVersion as any).mock.calls[0].arguments[0], 'alvo');
  });

  test('super admin redefine a senha de outro super admin', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ isSuperAdmin: true })
    );
    banco({ id: 'alvo', email: 'sa@empresa.com', isSuperAdmin: true });
    const res = await readApi(await resetar());
    assert.strictEqual(res.status, 200);
  });
});
