import assert from "node:assert";
import test from "node:test";
import { PATCH } from "../../../../../../../../app/api/admin/coletores/[id]/status/route.ts";

function makeRequest(body: unknown) {
  return new Request("http://test/api/admin/coletores/c1/status", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const params = { params: Promise.resolve({ id: "c1" }) } as any;

test.describe("app/api/admin/coletores/[id]/status", () => {
  let sessionModule: any;
  let permissionsModule: any;
  let serviceModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../../../lib/auth/permissions.ts");
    serviceModule = await import("../../../../../../../../lib/collectors/service.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await PATCH(makeRequest({ status: "active" }), params);
    assert.strictEqual(res.status, 401);
  });

  test("403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await PATCH(makeRequest({ status: "active" }), params);
    assert.strictEqual(res.status, 403);
  });

  test("400 para status inválido", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    const res = await PATCH(makeRequest({ status: "invalid" }), params);
    assert.strictEqual(res.status, 400);
  });

  test("404 quando update não encontra registro", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "updateCollectorStatus", async () => {
      throw new Error("Record to update not found");
    });

    const res = await PATCH(makeRequest({ status: "active" }), params);
    assert.strictEqual(res.status, 404);
  });

  test("200 sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "updateCollectorStatus", async (id: string, status: string) => ({
      id,
      status,
    }));

    const res = await PATCH(makeRequest({ status: "blocked" }), params);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.collector.status, "blocked");
  });

  test("500 erro genérico", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "updateCollectorStatus", async () => {
      throw new Error("boom");
    });

    const res = await PATCH(makeRequest({ status: "blocked" }), params);
    assert.strictEqual(res.status, 500);
  });
});
