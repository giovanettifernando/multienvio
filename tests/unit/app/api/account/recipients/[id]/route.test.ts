import assert from "node:assert";
import test from "node:test";
import { GET, PUT, DELETE } from '@/app/api/account/recipients/[id]/route';
import * as helpers from '@/app/api/account/recipients/helpers';
import * as service from '@/modules/auth/application/account-recipients.service';
// Mock no módulo de origem: shared/validation/recipient só reexporta (getter não é mockável)
import * as validation from '@/modules/recipients/dto/recipient';
import { ApiError } from '@/platform/api/errors';

function makeRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    json: () => req.json(),
    nextUrl: new URL(url),
  } as any;
}

test.describe("app/api/account/recipients/[id]", () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("GET retorna 401 sem sessão", async () => {
    test.mock.method(helpers, "requireUserId", async () => {
      throw new ApiError({ code: "unauthorized", message: "no auth", status: 401 });
    });
    const res = await GET(makeRequest("http://test/api/account/recipients/r1"), { params: Promise.resolve({ id: "r1" }) } as any);
    assert.strictEqual(res.status, 401);
  });

  test("GET retorna destinatário", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    test.mock.method(service, "getRecipient", async () => ({ id: "r1", name: "Rec" }));
    const res = await GET(makeRequest("http://test/api/account/recipients/r1"), { params: Promise.resolve({ id: "r1" }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, "r1");
  });

  test("PUT retorna 400 se body inválido", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    test.mock.method(helpers, "enforceRecipientWriteLimit", () => {});
    const res = await PUT(
      makeRequest("http://test/api/account/recipients/r1", { method: "PUT", body: "{", headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ id: "r1" }) } as any,
    );
    assert.strictEqual(res.status, 400);
  });

  test("PUT atualiza destinatário", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    test.mock.method(helpers, "enforceRecipientWriteLimit", () => {});
    test.mock.method(validation, "validateRecipientUpdateInput", () => ({ name: "Novo" }));
    test.mock.method(service, "updateRecipient", async () => ({ id: "r1", name: "Novo" }));
    const res = await PUT(
      makeRequest("http://test/api/account/recipients/r1", { method: "PUT", body: JSON.stringify({ name: "Novo" }), headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ id: "r1" }) } as any,
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.name, "Novo");
  });

  test("DELETE remove destinatário", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    test.mock.method(helpers, "enforceRecipientWriteLimit", () => {});
    test.mock.method(service, "deleteRecipient", async () => {});
    const res = await DELETE(makeRequest("http://test/api/account/recipients/r1", { method: "DELETE" }), { params: Promise.resolve({ id: "r1" }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.deleted, true);
  });
});
