import assert from "node:assert";
import test from "node:test";
import { GET } from "../../../../../../../app/api/admin/finance/reports/route.ts";

function makeRequest(url: string) {
  return {
    method: "GET",
    headers: new Headers(),
    nextUrl: new URL(url),
  } as any;
}

test.describe("app/api/admin/finance/reports", () => {
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
    const res = await GET(makeRequest("http://test/api/admin/finance/reports"));
    assert.strictEqual(res.status, 401);
  });

  test("403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await GET(makeRequest("http://test/api/admin/finance/reports"));
    assert.strictEqual(res.status, 403);
  });

  test("retorna CSV para dre", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["FINANCEIRO"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);

    const res = await GET(makeRequest("http://test/api/admin/finance/reports?report=dre&dateStart=2025-01-01&dateEnd=2025-01-31"));
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("Relatório DRE"));
    assert.strictEqual(res.headers.get("Content-Type"), "text/csv");
  });
});
