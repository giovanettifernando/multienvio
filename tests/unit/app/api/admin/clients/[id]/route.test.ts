import assert from "node:assert";
import test from "node:test";
import { PUT } from '@/app/api/admin/clients/[id]/route';

function makeRequest(url: string) {
  return {
    method: "PUT",
    headers: new Headers(),
    nextUrl: new URL(url),
  } as any;
}

test.describe("app/api/admin/clients/[id]", () => {
  let sessionModule: any;
  let permissionsModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../../lib/auth/permissions.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("retorna 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await PUT(makeRequest("http://test/api/admin/clients/c1"));
    assert.strictEqual(res.status, 401);
  });

  test("retorna 403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: [],
      isSuperAdmin: false,
    }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response(JSON.stringify({ message: "forbidden" }), { status: 403 }) as any,
    );

    const res = await PUT(makeRequest("http://test/api/admin/clients/c1"));
    assert.strictEqual(res.status, 403);
  });

  test("retorna 200 no fluxo feliz", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["CONTAS"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);

    const res = await PUT(makeRequest("http://test/api/admin/clients/c1"));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { ok: true });
  });
});
