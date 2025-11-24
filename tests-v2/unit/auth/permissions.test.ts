import assert from 'node:assert';
import test from 'node:test';
import {
  canAccess,
  hasAnyPermission,
  requirePermission,
  requireAnyPermission,
} from '../../../lib/auth/permissions.ts';

const user = { isSuperAdmin: false, permissions: ['READ', 'WRITE'] as any };

test.describe('auth/permissions', () => {
  test('canAccess e hasAnyPermission respeitam superadmin, perms e ausência de usuário', () => {
    assert.strictEqual(canAccess(null, 'READ' as any), false);
    assert.strictEqual(canAccess({ isSuperAdmin: true, permissions: [] as any }, 'ANY' as any), true);
    assert.strictEqual(canAccess(user, 'READ' as any), true);
    assert.strictEqual(canAccess(user, 'ADMIN' as any), false);

    assert.strictEqual(hasAnyPermission(null, ['READ'] as any), false);
    assert.strictEqual(hasAnyPermission({ isSuperAdmin: true, permissions: [] as any }, ['ANY'] as any), true);
    assert.strictEqual(hasAnyPermission(user, ['ADMIN', 'WRITE'] as any), true);
    assert.strictEqual(hasAnyPermission(user, ['ADMIN'] as any), false);
  });

  test('requirePermission retorna respostas 401/403 e null quando autorizado', () => {
    const unauth = requirePermission(null, 'ANY' as any);
    assert.strictEqual(unauth?.status, 401);

    const forbidden = requirePermission({ isSuperAdmin: false, permissions: [] } as any, 'WRITE' as any);
    assert.strictEqual(forbidden?.status, 403);

    const ok = requirePermission({ isSuperAdmin: false, permissions: ['WRITE'] } as any, 'WRITE' as any);
    assert.strictEqual(ok, null);

    const superAdminOk = requirePermission({ isSuperAdmin: true, permissions: [] } as any, 'WRITE' as any);
    assert.strictEqual(superAdminOk, null);
  });

  test('requireAnyPermission aceita qualquer perm e bloqueia ausência', () => {
    const unauth = requireAnyPermission(null, ['X'] as any);
    assert.strictEqual(unauth?.status, 401);

    const forbidden = requireAnyPermission({ isSuperAdmin: false, permissions: ['A'] } as any, ['B', 'C'] as any);
    assert.strictEqual(forbidden?.status, 403);

    const ok = requireAnyPermission({ isSuperAdmin: false, permissions: ['B'] } as any, ['B', 'C'] as any);
    assert.strictEqual(ok, null);
  });
});
