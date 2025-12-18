import assert from "node:assert";
import test from "node:test";
import { POST } from '@/app/api/admin/finance/ledger/reconcile/route';

function makeRequest(body: unknown) {
  return new Request("http://test/api/admin/finance/ledger/reconcile", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

test.describe("app/api/admin/finance/ledger/reconcile", () => {
  let sessionModule: any;
  let permissionsModule: any;
  let rateLimitModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../../../lib/auth/permissions.ts");
    rateLimitModule = await import("../../../../../../../../lib/rate-limit.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await POST(makeRequest({ ids: ["ldg1"] }));
    assert.strictEqual(res.status, 401);
  });

  test("403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await POST(makeRequest({ ids: ["ldg1"] }));
    assert.strictEqual(res.status, 403);
  });

  test("429 quando rate limit bloqueia", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(rateLimitModule, "rateLimitByUser", () => new Response("{}", { status: 429 }) as any);

    const res = await POST(makeRequest({ ids: ["ldg1"] }));
    assert.strictEqual(res.status, 429);
  });

  test("200 sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(rateLimitModule, "rateLimitByUser", () => null);

    const res = await POST(makeRequest({ ids: ["ldg1", "ldg2"] }));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { ok: true });
  });

  test("500 quando body não é JSON", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(rateLimitModule, "rateLimitByUser", () => null);

    const badReq = new Request("http://test/api/admin/finance/ledger/reconcile", {
      method: "POST",
      body: "{invalid",
      headers: { "content-type": "application/json" },
    });
    await assert.rejects(async () => POST(badReq));
  });
});
