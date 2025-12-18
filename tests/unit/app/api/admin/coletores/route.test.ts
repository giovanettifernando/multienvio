import assert from "node:assert";
import test from "node:test";
import { GET, POST } from '@/app/api/admin/coletores/route';

function makeRequest(method: "GET" | "POST", url = "http://test/api/admin/coletores", body?: unknown) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

test.describe("app/api/admin/coletores", () => {
  let sessionModule: any;
  let permissionsModule: any;
  let serviceModule: any;
  let schemaModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../lib/auth/permissions.ts");
    serviceModule = await import("../../../../../../lib/collectors/service.ts");
    schemaModule = await import("../../../../../../lib/collectors/schemas.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("GET 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await GET(makeRequest("GET"));
    assert.strictEqual(res.status, 401);
  });

  test("GET 403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await GET(makeRequest("GET"));
    assert.strictEqual(res.status, 403);
  });

  test("GET lista com filtros", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      isSuperAdmin: true,
      permissions: ["COLETORES"],
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "listCollectors", async (filters: any) => {
      assert.strictEqual(filters.q, "ana");
      assert.strictEqual(filters.status, "active");
      return { items: [{ id: "c1" }], total: 1, page: 1, pageSize: 10 };
    });

    const res = await GET(makeRequest("GET", "http://test/api/admin/coletores?q=ana&status=active"));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.items[0].id, "c1");
  });

  test("GET 500 em erro do service", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      isSuperAdmin: true,
      permissions: ["COLETORES"],
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(serviceModule, "listCollectors", async () => {
      throw new Error("fail");
    });

    const res = await GET(makeRequest("GET"));
    assert.strictEqual(res.status, 500);
  });

  test("POST 401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const res = await POST(makeRequest("POST", undefined, {}));
    assert.strictEqual(res.status, 401);
  });

  test("POST 403 sem permissão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(
      permissionsModule,
      "requirePermission",
      () => new Response("{}", { status: 403 }) as any,
    );
    const res = await POST(makeRequest("POST", undefined, {}));
    assert.strictEqual(res.status, 403);
  });

  test("POST 400 em dados inválidos", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      isSuperAdmin: true,
      permissions: ["COLETORES"],
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(schemaModule.collectorFormSchema, "parse", () => {
      const err: any = { issues: [{ message: "invalid" }] };
      throw err;
    });

    const res = await POST(makeRequest("POST", undefined, {}));
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.message, "Dados inválidos");
  });

  test("POST 500 em erro do createCollector", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      isSuperAdmin: true,
      permissions: ["COLETORES"],
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(schemaModule.collectorFormSchema, "parse", (b: any) => b);
    test.mock.method(serviceModule, "createCollector", async () => {
      throw new Error("create fail");
    });

    const res = await POST(makeRequest("POST", undefined, { name: "Ana" }));
    assert.strictEqual(res.status, 500);
  });

  test("POST cria coletor com sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({
      staffId: "s1",
      isSuperAdmin: true,
      permissions: ["COLETORES"],
    }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    test.mock.method(schemaModule.collectorFormSchema, "parse", (b: any) => b);
    test.mock.method(serviceModule, "createCollector", async (data: any) => ({ id: "c2", ...data }));

    const res = await POST(makeRequest("POST", undefined, { name: "Novo" }));
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.collector.id, "c2");
  });
});
