import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../../../../../app/api/health/route.ts';

function mockRequest() {
  const headers = new Map<string, string>();
  return {
    method: 'GET',
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    nextUrl: new URL('http://test/health'),
  } as any;
}

test.describe('app/api/health/route', () => {
  test('retorna status ok com metadados', async () => {
    const res = await GET(mockRequest(), { params: Promise.resolve({}) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.status, 'ok');
    assert.ok(body.data.version);
    assert.strictEqual(body.error, null);
  });
});
