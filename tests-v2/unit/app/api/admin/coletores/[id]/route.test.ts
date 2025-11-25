import assert from "node:assert";
import test from "node:test";
import { GET, PATCH, DELETE } from "../../../../../../../app/api/admin/coletores/[id]/route.ts";

function makeRequest(method: "GET" | "PATCH" | "DELETE", url = "http://test/api/admin/coletores/c1", body?: unknown) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

const params = { params: Promise.resolve({ id: "c1" }) } as any;

test.describe("app/api/admin/coletores/[id]", () => {
  let sessionModule: any;
  let permissionsModule: any;
  let serviceModule: any;
  let schemaModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../../lib/auth/permissions.ts");
    serviceModule = await import("../../../../../../../lib/collectors/service.ts");
    schemaModule = await import("../../../../../../../lib/collectors/schemas.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("GET 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await GET(makeRequest("GET"), params);
    assert.strictEqual(res.status, 401);
  });

  test("GET 403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await GET(makeRequest("GET"), params);
    assert.strictEqual(res.status, 403);
  });

  test("GET 404 quando coletor não encontrado", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["COLETORES"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "getCollectorById", async () => null);

    const res = await GET(makeRequest("GET"), params);
    assert.strictEqual(res.status, 404);
  });

  test("GET 200 retorna coletor", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      permissions: ["COLETORES"],
      isSuperAdmin: true,
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "getCollectorById", async (id: string) => ({ id, name: "Ana" }));

    const res = await GET(makeRequest("GET"), params);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.collector.id, "c1");
  });

  test("PATCH 400 em validação Zod", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(schemaModule.collectorFormSchema, "parse", () => {
      const err: any = { issues: [{ message: "invalid" }] };
      throw err;
    });

    const res = await PATCH(makeRequest("PATCH", undefined, {}), params);
    assert.strictEqual(res.status, 400);
  });

  test("PATCH 404 quando update falha", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(schemaModule.collectorFormSchema, "parse", (b: any) => b);
    test.mock.method(serviceModule, "updateCollector", async () => {
      throw new Error("Record to update not found");
    });

    const res = await PATCH(makeRequest("PATCH", undefined, { name: "Ana" }), params);
    assert.strictEqual(res.status, 404);
  });

  test("PATCH 200 sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(schemaModule.collectorFormSchema, "parse", (b: any) => b);
    test.mock.method(serviceModule, "updateCollector", async (id: string, data: any) => ({ id, ...data }));

    const res = await PATCH(makeRequest("PATCH", undefined, { name: "Ana" }), params);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.collector.id, "c1");
  });

  test("PATCH 500 erro genérico", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(schemaModule.collectorFormSchema, "parse", (b: any) => b);
    test.mock.method(serviceModule, "updateCollector", async () => {
      throw new Error("other");
    });

    const res = await PATCH(makeRequest("PATCH", undefined, { name: "Ana" }), params);
    assert.strictEqual(res.status, 500);
  });

  test("DELETE 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await DELETE(makeRequest("DELETE"), params);
    assert.strictEqual(res.status, 401);
  });

  test("DELETE 404 quando não encontrado", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "deleteCollector", async () => {
      throw new Error("Record to delete does not exist");
    });

    const res = await DELETE(makeRequest("DELETE"), params);
    assert.strictEqual(res.status, 404);
  });

  test("DELETE 500 em erro genérico", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "deleteCollector", async () => {
      throw new Error("boom");
    });

    const res = await DELETE(makeRequest("DELETE"), params);
    assert.strictEqual(res.status, 500);
  });

  test("DELETE 200 sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "deleteCollector", async () => undefined);

    const res = await DELETE(makeRequest("DELETE"), params);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.message, "Coletor excluído com sucesso");
  });
});
