import { describe, it } from 'node:test';
import { sign, verify } from '@/modules/auth/application/session';
import { getRouteProtection, isAuthApiRoute, isPublicRoute } from '@/modules/auth/application/route-protection';
import assert from 'node:assert/strict';

describe('auth session helpers', () => {
  it('assina e verifica payload básico', async () => {
    const token = await sign({ userId: 'u1', email: 'u@test.com', role: 'user', tokenVersion: 0 });
    const { payload, error } = await verify(token);
    assert.strictEqual(error, null);
    assert.strictEqual(payload?.userId, 'u1');
    assert.strictEqual(payload?.role, 'user');
  });

  it('recusa token adulterado', async () => {
    const token = await sign({ userId: 'u1', email: 'u@test.com', role: 'user', tokenVersion: 0 });
    const [header, corpo, assinatura] = token.split('.');
    // troca o usuário no corpo sem reassinar
    const corpoAdulterado = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(corpo, 'base64url').toString()), userId: 'admin' })
    ).toString('base64url');

    const { payload, error } = await verify(`${header}.${corpoAdulterado}.${assinatura}`);

    assert.strictEqual(payload, null);
    assert.notStrictEqual(error, null);
  });

  it('mapeia rotas corretamente', () => {
    assert.strictEqual(getRouteProtection('/api/auth/login'), null);
    assert.strictEqual(isPublicRoute('/'), true);
    assert.strictEqual(isAuthApiRoute('/api/cart/checkout'), true);
    assert.strictEqual(getRouteProtection('/api/admin/staff/users'), 'admin');
  });
});
