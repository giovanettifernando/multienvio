import assert from "node:assert";
import test from "node:test";
import { GET } from "../../../../../../app/api/admin/clients/route.ts";

function makeRequest(url: string) {
  return {
    method: "GET",
    headers: new Headers(),
    nextUrl: new URL(url),
  } as any;
}

test.describe("app/api/admin/clients", () => {
  let sessionModule: any;
  let permissionsModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../lib/auth/permissions.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("retorna 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);

    const res = await GET(makeRequest("http://test/api/admin/clients"));
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

    const res = await GET(makeRequest("http://test/api/admin/clients"));
    assert.strictEqual(res.status, 403);
  });

  test("filtra por q/type/status e pagina", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["CONTAS"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);

    const res = await GET(makeRequest("http://test/api/admin/clients?q=tech&type=PJ&status=active&page=1&pageSize=2"));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.pageSize, 2);
    assert.ok(body.items.every((c: any) => c.type === "PJ" && c.status === "active"));
  });

  test("retorna 500 quando handler lança erro", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["CONTAS"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => {
      throw new Error("boom");
    });

    await assert.rejects(async () => GET(makeRequest("http://test/api/admin/clients")), /boom/);
  });
});
