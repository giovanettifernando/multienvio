import assert from 'node:assert';
import test from 'node:test';
import {
  generateToken,
  hashToken,
  generateTokenWithExpiry,
  isTokenExpired,
} from '@/modules/auth/application/tokens';

test.describe('auth/tokens', () => {
  test('generateToken cria token hex com tamanho esperado', () => {
    const token = generateToken(4);
    assert.strictEqual(typeof token, 'string');
    // 4 bytes -> 8 hex chars
    assert.strictEqual(token.length, 8);
  });

  test('hashToken é determinístico', () => {
    const token = 'abc123';
    const h1 = hashToken(token);
    const h2 = hashToken(token);
    assert.strictEqual(h1, h2);
  });

  test('generateTokenWithExpiry retorna token, hash e expiry futuro', () => {
    const { token, hashedToken, expiry } = generateTokenWithExpiry(1);
    assert.ok(token.length > 0);
    assert.ok(hashedToken.length > 0);
    assert.ok(expiry.getTime() > Date.now());
  });

  test('isTokenExpired avalia nulo e datas passadas/futuras', () => {
    assert.strictEqual(isTokenExpired(null), true);
    assert.strictEqual(isTokenExpired(new Date(Date.now() - 1000)), true);
    assert.strictEqual(isTokenExpired(new Date(Date.now() + 1000)), false);
  });
});
