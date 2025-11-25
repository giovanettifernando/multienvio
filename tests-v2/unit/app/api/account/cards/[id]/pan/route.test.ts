import assert from "node:assert";
import test from "node:test";
import { POST } from "../../../../../../../../app/api/account/cards/[id]/pan/route.ts";
import * as helpers from "../../../../../../../../app/api/account/cards/helpers.ts";
import * as service from "../../../../../../../../lib/services/account-cards.service.ts";
import { ApiError } from "../../../../../../../../lib/api/errors.ts";

const originalEnvToken = process.env.CARD_DEV_AUTH_TOKEN;

function makeRequest(url: string, headers?: Record<string, string>) {
  const req = new Request(url, { method: "POST", headers });
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    nextUrl: new URL(url),
    json: () => req.json(),
  } as any;
}

test.describe("app/api/account/cards/[id]/pan", () => {
  test.afterEach(() => {
    test.mock.restoreAll();
    process.env.CARD_DEV_AUTH_TOKEN = originalEnvToken;
  });

  test("falha se token de dev não configurado", async () => {
    delete process.env.CARD_DEV_AUTH_TOKEN;
    test.mock.method(helpers, "requireUserId", async () => "u1");
    const res = await POST(makeRequest("http://test/api/account/cards/c1/pan"), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 403);
  });

  test("falha se header inválido", async () => {
    process.env.CARD_DEV_AUTH_TOKEN = "secret";
    test.mock.method(helpers, "requireUserId", async () => "u1");
    const res = await POST(makeRequest("http://test/api/account/cards/c1/pan", { "x-dev-auth": "wrong" }), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 403);
  });

  test("retorna PAN quando autorizado", async () => {
    process.env.CARD_DEV_AUTH_TOKEN = "secret";
    test.mock.method(helpers, "requireUserId", async () => "u1");
    test.mock.method(service, "getCardPanForDev", async () => "4111111111111111");
    const res = await POST(
      makeRequest("http://test/api/account/cards/c1/pan", { "x-dev-auth": "secret" }),
      { params: Promise.resolve({ id: "c1" }) } as any,
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.pan, "4111111111111111");
  });
});
