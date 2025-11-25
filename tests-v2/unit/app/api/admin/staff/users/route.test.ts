import assert from 'node:assert';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { GET, POST } from '../../../../../../../app/api/admin/staff/users/route.ts';
import * as adminHelpers from '../../../../../../../lib/auth/admin-helpers.ts';
import { AdminPermission } from '@prisma/client';
import { prisma } from '../../../../../../../lib/db.ts';

const originalPrisma = { ...prisma };
const originalRequireAdminUser = adminHelpers.requireAdminUser;

function makeRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    json: () => req.json(),
    nextUrl: new URL(url),
  } as any;
}

test.describe('app/api/admin/staff/users (lista/cria)', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, originalPrisma);
    adminHelpers.requireAdminUser = originalRequireAdminUser;
  });

  test('GET retorna 401 quando requireAdminUser bloqueia', async () => {
    const fakeResponse = NextResponse.json({ message: 'forbidden' }, { status: 401 });
    test.mock.method(adminHelpers, 'requireAdminUser', async () => fakeResponse);
    const res = await GET(makeRequest('http://test/api/admin/staff/users'), { params: Promise.resolve({} as any) } as any);
    assert.strictEqual(res.status, 401);
  });

  test('GET lista usuários com filtros básicos', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => true);
    prisma.staffUser = {
      findMany: async () => [
        {
          id: 's1',
          name: 'Staff',
          email: 'a@b.com',
          phone: null,
          status: 'ACTIVE',
          isSuperAdmin: false,
          permissions: [AdminPermission.USUARIOS],
          lastAccessAt: new Date(),
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      count: async () => 1,
    } as any;
    prisma.$transaction = async (ops: any[]) => Promise.all(ops.map((op) => op));
    const res = await GET(makeRequest('http://test/api/admin/staff/users?page=1&pageSize=10'), { params: Promise.resolve({} as any) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.total, 1);
    assert.strictEqual(body.items[0].id, 's1');
  });

  test('POST retorna 409 se email já existe', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => true);
    prisma.staffUser = {
      findUnique: async () => ({ id: 's1' }),
    } as any;
    const res = await POST(
      makeRequest('http://test/api/admin/staff/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'A', email: 'a@b.com', status: 'ACTIVE', permissions: [AdminPermission.USUARIOS] }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    assert.strictEqual(res.status, 409);
  });

  test('POST cria usuário e retorna tempPassword', async () => {
    test.mock.method(adminHelpers, 'requireAdminUser', async () => true);
    prisma.staffRole = {
      findFirst: async () => ({ id: 'r1' }),
    } as any;
    prisma.staffUser = {
      findUnique: async () => null,
      create: async ({ data }: any) => ({
        ...data,
        id: 's1',
        phone: null,
        lastAccessAt: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    const res = await POST(
      makeRequest('http://test/api/admin/staff/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'A', email: 'a@b.com', status: 'ACTIVE', permissions: [AdminPermission.USUARIOS] }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.user.id, 's1');
    assert.ok(body.tempPassword);
  });
});
