import assert from 'node:assert';
import test from 'node:test';
import { GET, POST, PATCH, DELETE } from '@/app/api/payments/methods/route';

test.describe('app/api/payments/methods/route (deprecated)', () => {
  async function expectGone(resPromise: Promise<Response>) {
    const res = await resPromise;
    assert.strictEqual(res.status, 410);
    const body = await res.json();
    assert.strictEqual(body.error, 'ENDPOINT_DEPRECATED');
    assert.ok(res.headers.get('X-Endpoint-Status'));
  }

  test('GET retorna 410', async () => {
    await expectGone(GET());
  });

  test('POST/PATCH/DELETE retornam 410', async () => {
    await expectGone(POST());
    await expectGone(PATCH());
    await expectGone(DELETE());
  });
});
