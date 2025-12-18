import assert from 'node:assert';
import test from 'node:test';
import { GET, PUT } from '@/app/api/system/status/route';
import * as statusService from '@/lib/services/system-status.service';

function makeRequest(method: string, body?: unknown) {
  const headers = new Map<string, string>([['content-type', 'application/json']]);
  return {
    method,
    json: async () => body,
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    nextUrl: new URL('http://test/system/status'),
  } as any;
}

const { mock } = test;

test.describe('app/api/system/status', () => {
  test('GET retorna status do sistema', async () => {
    const getMock = mock.method(statusService, 'getSystemStatus', async () => ({
      maintenance: false,
      message: null,
      updatedAt: new Date().toISOString(),
    }));
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({}) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.maintenance, false);
    assert.strictEqual(body.meta.tags.includes('system'), true);
    getMock.mock.restore();
  });

  test('PUT valida payload e atualiza status', async () => {
    const updateMock = mock.method(statusService, 'updateSystemStatus', async (input: any) => ({
      maintenance: input.maintenance ?? false,
      message: input.message ?? null,
      updatedAt: new Date().toISOString(),
    }));

    const res = await PUT(makeRequest('PUT', { maintenance: true, message: 'Manutenção' }), {
      params: Promise.resolve({}),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.maintenance, true);
    assert.strictEqual(body.data.message, 'Manutenção');
    updateMock.mock.restore();
  });

  test('PUT rejeita corpo inválido', async () => {
    const res = await PUT(makeRequest('PUT', { foo: 'bar' }), { params: Promise.resolve({}) });
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });
});
