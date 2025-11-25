import assert from "node:assert";
import test from "node:test";
import { GET } from "../../../../../../../app/api/admin/finance/payouts/route.ts";

function makeRequest(url: string) {
  return {
    method: "GET",
    headers: new Headers(),
    nextUrl: new URL(url),
  } as any;
}

test.describe("app/api/admin/finance/payouts", () => {
  let sessionModule: any;
  let permissionsModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../../lib/auth/permissions.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await GET(makeRequest("http://test/api/admin/finance/payouts"));
    assert.strictEqual(res.status, 401);
  });

  test("403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await GET(makeRequest("http://test/api/admin/finance/payouts"));
    assert.strictEqual(res.status, 403);
  });

  test("filtra por carrier/status com paginação", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["FINANCEIRO"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);

    const res = await GET(makeRequest("http://test/api/admin/finance/payouts?carrier=Correios&status=paid&page=1&pageSize=1"));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.pageSize, 1);
    assert.ok(body.items.every((p: any) => p.carrier === "Correios" || p.status === "paid"));
  });
});
