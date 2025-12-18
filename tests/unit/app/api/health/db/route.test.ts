import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/health/db/route';
import { prisma } from '@/platform/db/db';

function mockRequest() {
  const headers = new Map<string, string>();
  return {
    method: 'GET',
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    nextUrl: new URL('http://test/health/db'),
  } as any;
}

const originalQueryRaw = prisma.$queryRaw;
const originalDisconnect = prisma.$disconnect;

test.describe('app/api/health/db/route', () => {
  test.afterEach(() => {
    prisma.$queryRaw = originalQueryRaw;
    prisma.$disconnect = originalDisconnect;
  });

  test('retorna ok quando ping funciona', async () => {
    prisma.$queryRaw = async () => 1 as any;
    const res = await GET(mockRequest(), { params: Promise.resolve({}) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.status, 'ok');
  });

  test('retorna 503 quando ping falha e agenda reconnect', async () => {
    prisma.$queryRaw = async () => {
      throw new Error('db down');
    };
    let disconnected = false;
    prisma.$disconnect = async () => {
      disconnected = true;
    };
    const res = await GET(mockRequest(), { params: Promise.resolve({}) });
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.data.status, 'unavailable');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(disconnected, true);
  });
});
