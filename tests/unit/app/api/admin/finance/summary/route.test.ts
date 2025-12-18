import assert from "node:assert";
import test from "node:test";
import { GET } from '@/app/api/admin/finance/summary/route';

function makeRequest(url: string) {
  return {
    method: "GET",
    headers: new Headers(),
    nextUrl: new URL(url),
  } as any;
}

test.describe("app/api/admin/finance/summary", () => {
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
    const res = await GET(makeRequest("http://test/api/admin/finance/summary"));
    assert.strictEqual(res.status, 401);
  });

  test("403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await GET(makeRequest("http://test/api/admin/finance/summary"));
    assert.strictEqual(res.status, 403);
  });

  test("200 com summary e datas opcionais", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["FINANCEIRO"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);

    const res = await GET(makeRequest("http://test/api/admin/finance/summary?dateStart=2025-01-01&dateEnd=2025-01-31"));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.period.dateStart, "2025-01-01");
    assert.strictEqual(body.period.dateEnd, "2025-01-31");
    assert.ok(body.grossRevenue > 0);
  });
});
