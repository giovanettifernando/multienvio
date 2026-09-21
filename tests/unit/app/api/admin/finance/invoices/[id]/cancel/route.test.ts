import assert from "node:assert";
import test from "node:test";
import { POST } from '@/app/api/admin/finance/invoices/[id]/cancel/route';

function makeRequest() {
  return new Request("http://test/api/admin/finance/invoices/inv1/cancel", { method: "POST" });
}

const params = { params: Promise.resolve({ id: "inv1" }) } as any;

test.describe("app/api/admin/finance/invoices/[id]/cancel", () => {
  let sessionModule: any;
  let permissionsModule: any;
  let rateLimitModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../../../modules/auth/application/admin-session.ts");
    permissionsModule = await import("../../../../../../../../../modules/auth/application/permissions.ts");
    rateLimitModule = await import("../../../../../../../../../platform/api/rate-limit.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 401);
  });

  test("403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 403);
  });

  test("429 quando rate limit bloqueia", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(rateLimitModule, "rateLimitByUser", () => new Response("{}", { status: 429 }) as any);

    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 429);
  });

  test("200 sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(rateLimitModule, "rateLimitByUser", () => null);

    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { ok: true });
  });
});
