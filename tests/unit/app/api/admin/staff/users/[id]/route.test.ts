import assert from "node:assert";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET, PUT, DELETE } from '@/app/api/admin/staff/users/[id]/route';
import * as adminHelpers from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from "@prisma/client";
import { prisma } from '@/platform/db/db';

const originalPrisma = { ...prisma };

function makeRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    nextUrl: new URL(url),
    json: () => req.json(),
  } as any;
}

test.describe("app/api/admin/staff/users/[id]", () => {
  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, originalPrisma);
  });

  test("GET retorna 401 quando requireAdminUser bloqueia", async () => {
    const fake = NextResponse.json({ message: "forbidden" }, { status: 401 });
    test.mock.method(adminHelpers, "requireAdminUser", async () => fake);
    const res = await GET(makeRequest("http://test/api/admin/staff/users/s1"), { params: Promise.resolve({ id: "s1" }) } as any);
    assert.strictEqual(res.status, 401);
  });

  test("GET retorna 404 quando usuário não existe", async () => {
    test.mock.method(adminHelpers, "requireAdminUser", async () => true);
    prisma.staffUser = { findUnique: async () => null } as any;
    const res = await GET(makeRequest("http://test/api/admin/staff/users/s1"), { params: Promise.resolve({ id: "s1" }) } as any);
    assert.strictEqual(res.status, 404);
  });

  test("GET retorna usuário", async () => {
    test.mock.method(adminHelpers, "requireAdminUser", async () => true);
    prisma.staffUser = {
      findUnique: async () => ({
        id: "s1",
        name: "Staff",
        email: "a@b.com",
        phone: null,
        status: "ACTIVE",
        isSuperAdmin: false,
        permissions: [AdminPermission.USUARIOS],
        lastAccessAt: new Date(),
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    const res = await GET(makeRequest("http://test/api/admin/staff/users/s1"), { params: Promise.resolve({ id: "s1" }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.id, "s1");
  });

  test("PUT retorna 404 se não existe", async () => {
    test.mock.method(adminHelpers, "requireAdminUser", async () => true);
    prisma.staffUser = {
      findUnique: async () => null,
    } as any;
    const res = await PUT(
      makeRequest("http://test/api/admin/staff/users/s1", { method: "PUT", body: JSON.stringify({ name: "New" }), headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ id: "s1" }) } as any,
    );
    assert.strictEqual(res.status, 404);
  });

  test("PUT atualiza usuário", async () => {
    test.mock.method(adminHelpers, "requireAdminUser", async () => true);
    prisma.staffUser = {
      findUnique: async () => ({
        id: "s1",
        email: "a@b.com",
        isSuperAdmin: false,
        permissions: [AdminPermission.USUARIOS],
      }),
      update: async ({ data }: any) => ({
        id: "s1",
        name: data.name ?? "Staff",
        email: data.email ?? "a@b.com",
        phone: null,
        status: "ACTIVE",
        isSuperAdmin: data.isSuperAdmin ?? false,
        permissions: data.permissions ?? [AdminPermission.USUARIOS],
        lastAccessAt: new Date(),
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findUniqueOrThrow: async () => ({}),
    } as any;
    const res = await PUT(
      makeRequest("http://test/api/admin/staff/users/s1", { method: "PUT", body: JSON.stringify({ name: "New", permissions: [AdminPermission.USUARIOS] }), headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ id: "s1" }) } as any,
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.name, "New");
  });

  test("DELETE retorna 404 se não existe", async () => {
    test.mock.method(adminHelpers, "requireAdminUser", async () => true);
    prisma.staffUser = { findUnique: async () => null } as any;
    const res = await DELETE(makeRequest("http://test/api/admin/staff/users/s1", { method: "DELETE" }), { params: Promise.resolve({ id: "s1" }) } as any);
    assert.strictEqual(res.status, 404);
  });

  test("DELETE remove usuário", async () => {
    test.mock.method(adminHelpers, "requireAdminUser", async () => true);
    prisma.staffUser = {
      findUnique: async () => ({ id: "s1" }),
      delete: async () => ({}),
    } as any;
    const res = await DELETE(makeRequest("http://test/api/admin/staff/users/s1", { method: "DELETE" }), { params: Promise.resolve({ id: "s1" }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.match(body.message, /excluído/i);
  });
});
