import assert from "node:assert";
import test from "node:test";
import { prisma } from "../../../../../../../../lib/db.ts";
import { createRequire } from "module";

function makeRequest() {
  return new Request("http://test/api/admin/coletores/c1/reset-password", { method: "POST" });
}

const params = { params: Promise.resolve({ id: "c1" }) } as any;
const originalCollector = prisma.collector;
const originalEmailConfig = prisma.emailConfig;
const require = createRequire(import.meta.url);
const nodemailerPath = require.resolve("nodemailer");
const originalNodemailer = require("nodemailer");

test.describe("app/api/admin/coletores/[id]/reset-password", () => {
  let sessionModule: any;
  let permissionsModule: any;
  let encryptModule: any;

  test.before(async () => {
    sessionModule = await import("../../../../../../../../lib/auth/admin-session.ts");
    permissionsModule = await import("../../../../../../../../lib/auth/permissions.ts");
    encryptModule = await import("../../../../../../../../lib/integrations/shared/encryption.service.ts");
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.collector = originalCollector;
    prisma.emailConfig = originalEmailConfig;
    require.cache[nodemailerPath] = { exports: originalNodemailer };
  });

  async function loadPost() {
    const route = await import("../../../../../../../../app/api/admin/coletores/[id]/reset-password/route.ts");
    return route.POST;
  }

  test("401 sem sessão", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => null);
    const POST = await loadPost();
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
    const POST = await loadPost();
    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 403);
  });

  test("404 quando coletor não encontrado", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    prisma.collector = { findUnique: async () => null } as any;
    const POST = await loadPost();
    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 404);
  });

  test("400 quando coletor sem email ou não verificado", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    prisma.collector = {
      findUnique: async () => ({ id: "c1", pfNome: "Ana", pfEmail: null, pfEmailVerified: false, status: "ACTIVE" }),
    } as any;
    const POST = await loadPost();
    let res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 400);

    prisma.collector = {
      findUnique: async () => ({ id: "c1", pfNome: "Ana", pfEmail: "a@test.com", pfEmailVerified: false, status: "ACTIVE" }),
    } as any;
    res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 400);
  });

  test("500 quando emailConfig não encontrada", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    prisma.collector = {
      findUnique: async () => ({ id: "c1", pfNome: "Ana", pfEmail: "a@test.com", pfEmailVerified: true, status: "ACTIVE" }),
    } as any;
    prisma.emailConfig = { findFirst: async () => null } as any;

    const POST = await loadPost();
    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 500);
  });

  test("500 quando sendMail lança erro", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    prisma.collector = {
      findUnique: async () => ({ id: "c1", pfNome: "Ana", pfEmail: "a@test.com", pfEmailVerified: true, status: "ACTIVE" }),
    } as any;
    prisma.emailConfig = {
      findFirst: async () => ({
        status: "ACTIVE",
        host: "smtp",
        port: 587,
        secure: false,
        user: "u",
        password: "enc",
        fromName: "Envio",
        fromAddress: "noreply@test.com",
      }),
    } as any;
    test.mock.method(encryptModule, "decrypt", () => "pwd");
    require.cache[nodemailerPath] = {
      exports: {
        createTransport: () => ({
          sendMail: async () => {
            throw new Error("smtp fail");
          },
        }),
      },
    } as any;
    const POST = await loadPost();
    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 500);
  });

  test("200 envia reset com sucesso", async () => {
    test.mock.method(sessionModule, "getAdminSessionFromRequest", async () => ({ staffId: "s1" }));
    test.mock.method(permissionsModule, "requirePermission", () => null);
    prisma.collector = {
      findUnique: async () => ({ id: "c1", pfNome: "Ana", pfEmail: "a@test.com", pfEmailVerified: true, status: "ACTIVE" }),
    } as any;
    prisma.emailConfig = {
      findFirst: async () => ({
        status: "ACTIVE",
        host: "smtp",
        port: 587,
        secure: false,
        user: "u",
        password: "enc",
        fromName: "Envio",
        fromAddress: "noreply@test.com",
      }),
    } as any;
    test.mock.method(encryptModule, "decrypt", () => "pwd");
    let sent = false;
    require.cache[nodemailerPath] = {
      exports: {
        createTransport: () => ({
          sendMail: async () => {
            sent = true;
          },
        }),
      },
    } as any;
    const POST = await loadPost();
    const res = await POST(makeRequest(), params);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.message.includes("sucesso"), true);
    assert.ok(sent);
  });
});
