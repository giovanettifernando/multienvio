import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/admin/auth/logout/route';

function makeRequest() {
  return new Request('http://test/api/admin/auth/logout', { method: 'POST' });
}

test.describe('app/api/admin/auth/logout', () => {
  let sessionModule: any;
  let cookieModule: any;
  let cacheModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../../lib/auth/admin-session.ts');
    cookieModule = sessionModule;
    cacheModule = await import('../../../../../../../lib/cache.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await POST(makeRequest());
    assert.strictEqual(res.status, 401);
  });

  test('incrementa tokenVersion no Redis e remove cookie', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({ staffId: 's1' }));
    let tokenVersionIncremented = false;
    test.mock.method(cacheModule.staffSessionCache, 'incrementTokenVersion', async () => {
      tokenVersionIncremented = true;
      return 2;
    });
    test.mock.method(cookieModule, 'createAdminCookieRemovalHeader', () => 'admin=; Max-Age=0');

    const res = await POST(makeRequest());
    assert.strictEqual(res.status, 200);
    assert.ok(tokenVersionIncremented, 'tokenVersion should be incremented in Redis');
    assert.ok(res.headers.get('set-cookie')?.includes('admin='));
  });
});
