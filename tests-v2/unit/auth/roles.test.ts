import assert from 'node:assert';
import test from 'node:test';
import {
  ROLE_GROUPS,
  getAllRoles,
  getAllRoleKeys,
  isSuperAdminRole,
  getSuperAdminRoles,
  hasSuperAdmin,
  normalizeRoles,
  roleKeyToPermission,
  permissionToRoleKey,
  getPermissionLabel,
} from '../../../lib/auth/roles.ts';

test.describe('auth/roles', () => {
  test('getAllRoles e getAllRoleKeys retornam dados completos', () => {
    const roles = getAllRoles();
    assert.ok(roles.length > 0);
    const keys = getAllRoleKeys();
    assert.strictEqual(keys.length, roles.length);
    assert.deepStrictEqual(keys, roles.map((r) => r.key));
  });

  test('super admin helpers', () => {
    assert.strictEqual(isSuperAdminRole('admin.super'), true);
    assert.strictEqual(isSuperAdminRole('OUTRO'), false);
    const superRoles = getSuperAdminRoles();
    assert.ok(superRoles.includes('admin.super'));
    assert.strictEqual(hasSuperAdmin(['admin.super', 'X']), true);
    assert.strictEqual(hasSuperAdmin(['X', 'Y']), false);
  });

  test('normalizeRoles adiciona todos quando tem superadmin', () => {
    const normalized = normalizeRoles(['admin.super', 'OUTRO']);
    // deve conter admin.super e todas as demais keys sem duplicar
    for (const role of ROLE_GROUPS.flatMap((g) => g.roles)) {
      assert.ok(normalized.includes(role.key));
    }
  });

  test('roleKeyToPermission e permissionToRoleKey', () => {
    assert.strictEqual(roleKeyToPermission('admin.super'), null);
    const nonSuper = ROLE_GROUPS.flatMap((g) => g.roles).find((r) => r.key !== 'admin.super')!.key;
    assert.strictEqual(roleKeyToPermission(nonSuper), nonSuper);
    assert.strictEqual(permissionToRoleKey(nonSuper as any), nonSuper);
  });

  test('getPermissionLabel retorna label se existir ou a própria perm', () => {
    const anyRole = ROLE_GROUPS.flatMap((g) => g.roles).find((r) => r.key !== 'admin.super')!;
    assert.strictEqual(getPermissionLabel(anyRole.key as any), anyRole.label);
    assert.strictEqual(getPermissionLabel('admin.super' as any), 'admin.super'); // superadmin não tem label no map
    assert.strictEqual(getPermissionLabel('INEXISTENTE' as any), 'INEXISTENTE');
  });
});
