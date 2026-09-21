import assert from "node:assert";
import test from "node:test";
import { POST } from '@/app/api/admin/clients/reset-password/route';

function makeRequest(body: unknown) {
  return new Request("http://test/api/admin/clients/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

test.describe("app/api/admin/clients/reset-password", () => {
  let sessionModule: any;
  let permissionsModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../modules/auth/application/admin-session.ts");
    permissionsModule = await import("../../../../../../../modules/auth/application/permissions.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("retorna 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await POST(makeRequest({ clientId: "c1" }));
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
      () => new Response("{}", { status: 403 }) as any,
    );

    const res = await POST(makeRequest({ clientId: "c1" }));
    assert.strictEqual(res.status, 403);
  });

  test("fluxo feliz retorna ok", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["CONTAS"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);

    const res = await POST(makeRequest({ clientId: "c1" }));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { ok: true });
  });
});
