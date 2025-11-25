import assert from 'node:assert';
import test from 'node:test';
import { POST } from '../../../../../../../app/api/admin/auth/logout/route.ts';

function makeRequest() {
  return new Request('http://test/api/admin/auth/logout', { method: 'POST' });
}

test.describe('app/api/admin/auth/logout', () => {
  let sessionModule: any;
  let cookieModule: any;
  let dbModule: any;
  let originalPrisma: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../../lib/auth/admin-session.ts');
    cookieModule = sessionModule;
    dbModule = await import('../../../../../../../lib/db.ts');
    originalPrisma = dbModule.prisma.staffUser;
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    dbModule.prisma.staffUser = originalPrisma;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await POST(makeRequest());
    assert.strictEqual(res.status, 401);
  });

  test('incrementa tokenVersion e remove cookie', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({ staffId: 's1' }));
    let updated = false;
    dbModule.prisma.staffUser = {
      update: async () => {
        updated = true;
        return {};
      },
    } as any;
    test.mock.method(cookieModule, 'createAdminCookieRemovalHeader', () => 'admin=; Max-Age=0');

    const res = await POST(makeRequest());
    assert.strictEqual(res.status, 200);
    assert.ok(updated);
    assert.ok(res.headers.get('set-cookie')?.includes('admin='));
  });
});
