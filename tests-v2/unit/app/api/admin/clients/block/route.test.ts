import assert from "node:assert";
import test from "node:test";
import { POST } from "../../../../../../../app/api/admin/clients/block/route.ts";

function makeRequest(body: unknown) {
  return new Request("http://test/api/admin/clients/block", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

test.describe("app/api/admin/clients/block", () => {
  let sessionModule: any;
  let auditModule: any;
  let rateLimitModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../lib/auth/admin-session.ts");
    auditModule = await import("../../../../../../../lib/audit-admin.ts");
    rateLimitModule = await import("../../../../../../../lib/rate-limit.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("retorna 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await POST(makeRequest({ clientId: "c1" }));
    assert.strictEqual(res.status, 401);
  });

  test("retorna 429 quando rate limit bloqueia", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(rateLimitModule, "rateLimitByUser", () => new Response("{}", { status: 429 }) as any);

    const res = await POST(makeRequest({ clientId: "c1" }));
    assert.strictEqual(res.status, 429);
  });

  test("retorna 500 em erro interno", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(rateLimitModule, "rateLimitByUser", () => null);
    test.mock.method(global, "Request", () => {
      throw new Error("boom");
    });
    await assert.rejects(async () => POST(makeRequest({})), /boom/);
  });

  test("bloqueia cliente com sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(rateLimitModule, "rateLimitByUser", () => null);
    let logged = false;
    test.mock.method(auditModule, "logClientStatusChange", async (_staffId: string, clientId: string, action: string, reason: string) => {
      logged = clientId === "c1" && action === "block" && reason === "fraude";
    });

    const res = await POST(makeRequest({ clientId: "c1", reason: "fraude" }));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { ok: true });
    assert.ok(logged);
  });
});
