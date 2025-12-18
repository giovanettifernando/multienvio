import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/tracking/route';

test.describe('app/api/tracking/route', () => {
  test('retorna erro quando shipmentId ausente', async () => {
    const res = await GET(new Request('http://test/api/tracking'));
    assert.strictEqual(res.status, 400);
  });

  test('retorna tracking quando shipmentId presente', async () => {
    const res = await GET(new Request('http://test/api/tracking?shipmentId=abc123'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.shipmentId, 'abc123');
    assert.ok(body.events.length > 0);
  });
});
