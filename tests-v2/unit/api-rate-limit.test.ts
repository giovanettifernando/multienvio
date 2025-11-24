import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';

let rateLimitByIP: any;
let RATE_LIMITS: any;
const intervals: NodeJS.Timeout[] = [];
const originalSetInterval = global.setInterval;

function mockRequest(ip?: string) {
  const headers = new Map<string, string>();
  if (ip) headers.set('x-real-ip', ip);
  return {
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    method: 'GET',
    nextUrl: new URL('http://test'),
  } as any;
}

test.before(async () => {
  (globalThis as any).setInterval = (...args: any[]) => {
    const handle = originalSetInterval(...(args as [any, number]));
    intervals.push(handle);
    return handle;
  };
  const mod = await import('../../lib/rate-limit.ts');
  rateLimitByIP = mod.rateLimitByIP;
  RATE_LIMITS = mod.RATE_LIMITS;
  (globalThis as any).setInterval = originalSetInterval;
});

test.afterEach(() => {
  intervals.forEach((h) => clearInterval(h));
  intervals.length = 0;
});

test.describe('rate-limit', () => {
  test('permite requisições até o limite e bloqueia depois', () => {
    const config = { windowMs: 60_000, maxRequests: 2 };
    const req = mockRequest('1.1.1.1');

    const r1 = rateLimitByIP(req, 'login', config);
    assert.strictEqual(r1, null);
    const r2 = rateLimitByIP(req, 'login', config);
    assert.strictEqual(r2, null);
    const r3 = rateLimitByIP(req, 'login', config);
    assert.ok(r3 instanceof NextResponse);
    assert.strictEqual(r3?.status, 429);
  });

  test('não bloqueia quando IP não pode ser identificado', () => {
    const res = rateLimitByIP(mockRequest(), 'login', RATE_LIMITS.LOGIN);
    assert.strictEqual(res, null);
  });
});
