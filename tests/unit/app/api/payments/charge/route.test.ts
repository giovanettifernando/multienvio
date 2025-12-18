import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/payments/charge/route';

test.describe('app/api/payments/charge (deprecated)', () => {
  test('sempre retorna 410', async () => {
    const res = await POST();
    assert.strictEqual(res.status, 410);
    const body = await res.json();
    assert.strictEqual(body.error, 'ENDPOINT_DEPRECATED');
  });
});
