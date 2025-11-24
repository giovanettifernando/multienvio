import { describe, it } from 'node:test';
import { sign, verify } from '../../../lib/auth/session.ts';
import { getRouteProtection, isAuthApiRoute, isPublicRoute } from '../../../lib/auth/route-protection.ts';
import assert from 'node:assert/strict';

describe('auth session helpers', () => {
  it('assina e verifica payload básico', async () => {
    const token = await sign({ userId: 'u1', email: 'u@test.com', role: 'user', tokenVersion: 0 });
    const payload = await verify(token);
    assert.strictEqual(payload?.userId, 'u1');
    assert.strictEqual(payload?.role, 'user');
  });

  it('mapeia rotas corretamente', () => {
    assert.strictEqual(getRouteProtection('/api/auth/login'), null);
    assert.strictEqual(isPublicRoute('/'), true);
    assert.strictEqual(isAuthApiRoute('/api/cart/checkout'), true);
    assert.strictEqual(getRouteProtection('/api/admin/staff/users'), 'admin');
  });
});
