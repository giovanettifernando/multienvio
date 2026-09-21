import assert from "node:assert";
import test from "node:test";
import { GET } from '@/app/api/admin/finance/ledger/route';

function makeRequest(url: string) {
  return {
    method: "GET",
    headers: new Headers(),
    nextUrl: new URL(url),
  } as any;
}

test.describe("app/api/admin/finance/ledger", () => {
  let sessionModule: any;
  let permissionsModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../modules/auth/application/admin-session.ts");
    permissionsModule = await import("../../../../../../../modules/auth/application/permissions.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await GET(makeRequest("http://test/api/admin/finance/ledger"));
    assert.strictEqual(res.status, 401);
  });

  test("403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await GET(makeRequest("http://test/api/admin/finance/ledger"));
    assert.strictEqual(res.status, 403);
  });

  test("filtra por q e pagina", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["FINANCEIRO"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);

    const res = await GET(makeRequest("http://test/api/admin/finance/ledger?q=tech&page=1&pageSize=2"));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.pageSize, 2);
  });

  test("500 em erro inesperado", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["FINANCEIRO"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => {
      throw new Error("boom");
    });

    await assert.rejects(async () => GET(makeRequest("http://test/api/admin/finance/ledger")), /boom/);
  });
});
