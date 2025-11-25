import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../../../../../../../app/api/admin/auth/me/route.ts';
import { prisma } from '../../../../../../../lib/db.ts';

const originalStaff = prisma.staffUser;

function makeRequest() {
  return new Request('http://test/api/admin/auth/me');
}

test.describe('app/api/admin/auth/me', () => {
  let sessionModule: any;

  test.before(async () => {
    sessionModule = await import('../../../../../../../lib/auth/admin-session.ts');
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.staffUser = originalStaff;
  });

  test('retorna 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => null);
    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 401);
  });

  test('retorna 404 se usuário não existe', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({ staffId: 's1' }));
    prisma.staffUser = { findUnique: async () => null } as any;
    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 404);
  });

  test('retorna 403 se usuário bloqueado', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({ staffId: 's1' }));
    prisma.staffUser = {
      findUnique: async () => ({
        id: 's1',
        name: 'Admin',
        email: 'a@b.com',
        status: 'BLOCKED',
        isSuperAdmin: false,
        permissions: [],
        role: { name: 'operator' },
        lastLoginAt: null,
        lastAccessAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 403);
  });

  test('retorna dados quando autenticado e ativo', async () => {
    test.mock.method(sessionModule, 'getAdminSessionFromRequest', async () => ({ staffId: 's1' }));
    prisma.staffUser = {
      findUnique: async () => ({
        id: 's1',
        name: 'Admin',
        email: 'a@b.com',
        status: 'ACTIVE',
        isSuperAdmin: true,
        permissions: ['USUARIOS'],
        role: { name: 'admin' },
        lastLoginAt: new Date('2024-01-01'),
        lastAccessAt: new Date('2024-01-02'),
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      }),
    } as any;
    const res = await GET(makeRequest());
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.staff.id, 's1');
    assert.ok(Array.isArray(body.staff.permissions));
  });
});
