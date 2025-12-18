import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/wallet/transactions/route';

// Alias to statement by using same handler with different path params (no separate file)
test.describe('app/api/wallet/transactions (statement alias)', () => {
  test('handler está acessível', () => {
    assert.strictEqual(typeof GET, 'function');
  });
});
