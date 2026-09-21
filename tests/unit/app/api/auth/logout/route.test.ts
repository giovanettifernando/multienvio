import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/auth/logout/route';
import { prisma } from '@/platform/db/db';

const originalUser = prisma.user;

test.describe('app/api/auth/logout', () => {
  let sessionModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../modules/auth/application/session.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalUser;
  });

  test('retorna 500 em erro inesperado', async () => {
    test.mock.method(sessionModule, 'getSession', async () => {
      throw new Error('boom');
    });
    const res = await POST();
    assert.strictEqual(res.status, 500);
  });

  test('incrementa tokenVersion e destrói sessão', async () => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    let updated = false;
    prisma.user = {
      update: async () => {
        updated = true;
        return {};
      },
    } as any;
    let destroyed = false;
    test.mock.method(sessionModule, 'destroySession', async () => {
      destroyed = true;
    });
    const res = await POST();
    assert.strictEqual(res.status, 200);
    assert.ok(updated);
    assert.ok(destroyed);
  });
});
