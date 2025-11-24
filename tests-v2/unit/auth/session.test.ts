import { describe, it, strictEqual } from 'node:test';
import { sign, verify } from '@/lib/auth/session';
import { getRouteProtection, isAuthApiRoute, isPublicRoute } from '@/lib/auth/route-protection';

describe('auth session helpers', () => {
  it('assina e verifica payload básico', async () => {
    const token = await sign({ userId: 'u1', email: 'u@test.com', role: 'user', tokenVersion: 0 });
    const payload = await verify(token);
    strictEqual(payload?.userId, 'u1');
    strictEqual(payload?.role, 'user');
  });

  it('mapeia rotas corretamente', () => {
    strictEqual(getRouteProtection('/api/auth/login'), null);
    strictEqual(isPublicRoute('/'), true);
    strictEqual(isAuthApiRoute('/api/cart/checkout'), true);
    strictEqual(getRouteProtection('/api/admin/staff/users'), 'admin');
  });
});
