import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../../../../../app/api/units/route.ts';

test.describe('app/api/units/route', () => {
  test('retorna duas unidades por padrão', async () => {
    const res = await GET(new Request('http://test/api/units'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.length, 2);
  });

  test('retorna todas unidades quando ampliar=true', async () => {
    const res = await GET(new Request('http://test/api/units?ampliar=true'));
    const body = await res.json();
    assert.ok(body.length >= 3);
  });
});
