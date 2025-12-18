import assert from 'node:assert';
import test from 'node:test';
import { withApiHandler, ensureMethod } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

function mockRequest(method: string, url = 'http://test/path?foo=bar') {
  const nextUrl = new URL(url);
  const headers = new Map<string, string>();
  headers.set('x-request-id', 'req-123');
  headers.set('user-agent', 'agent');
  headers.set('x-real-ip', '1.1.1.1');
  return {
    method,
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    nextUrl,
  } as any;
}

test.describe('api/handler', () => {
  test('withApiHandler monta resposta de sucesso', async () => {
    const handler = withApiHandler(async ({ params }) => ({
      data: { ok: true, params },
      meta: { tags: ['test'] },
    }));

    const req = mockRequest('GET');
    const res = await handler(req, { params: Promise.resolve({ id: '1' }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.data, { ok: true, params: { id: '1' } });
    assert.strictEqual(body.error, null);
    assert.strictEqual(body.meta.path, '/path');
    assert.strictEqual(body.meta.method, 'GET');
  });

  test('withApiHandler converte erros em failure', async () => {
    const handler = withApiHandler(async () => {
      throw ApiError.forbidden('nope');
    });
    const res = await handler(mockRequest('POST'), { params: Promise.resolve({}) });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN');
    assert.strictEqual(body.data, null);
  });

  test('ensureMethod lança ApiError quando método não permitido', () => {
    const req = mockRequest('DELETE');
    assert.throws(() => ensureMethod(req as any, ['GET', 'POST']));
  });
});
