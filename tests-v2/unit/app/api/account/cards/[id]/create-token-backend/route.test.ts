import assert from "node:assert";
import test from "node:test";
import { POST } from "../../../../../../../../app/api/account/cards/[id]/create-token-backend/route.ts";
import *as helpers from "../../../../../../../../app/api/account/cards/helpers.ts";
import { prisma } from "../../../../../../../../lib/db.ts";
import * as vault from "../../../../../../../../lib/crypto/card-vault.ts";
import * as mpClient from "../../../../../../../../lib/mercadopago/client.ts";
import { ApiError } from "../../../../../../../../lib/api/errors.ts";

const originalCard = prisma.card;

function makeRequest(url: string, body: any) {
  const req = new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    nextUrl: new URL(url),
    json: () => req.json(),
  } as any;
}

test.describe("app/api/account/cards/[id]/create-token-backend", () => {
  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.card = originalCard;
  });

  test("retorna 400 se CVV ausente", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    const res = await POST(makeRequest("http://test/api/account/cards/c1/create-token-backend", { cpf: "123" }), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 400);
  });

  test("retorna 404 se cartão não encontrado", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = { findUnique: async () => null } as any;
    const res = await POST(makeRequest("http://test/api/account/cards/c1/create-token-backend", { cvv: "123", cpf: "12345678901" }), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 404);
  });

  test("retorna 403 se usuário não é dono", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = { findUnique: async () => ({ id: "c1", userId: "other", panCipher: "cipher" }) } as any;
    const res = await POST(makeRequest("http://test/api/account/cards/c1/create-token-backend", { cvv: "123", cpf: "12345678901" }), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 403);
  });

  test("retorna 400 se panCipher inválido", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = { findUnique: async () => ({ id: "c1", userId: "u1", panCipher: "bad", holderName: "U", expMonth: 12, expYear: 2030, brand: "VISA", last4: "1111" }) } as any;
    test.mock.method(vault, "parsePanCipher", () => null);
    const res = await POST(makeRequest("http://test/api/account/cards/c1/create-token-backend", { cvv: "123", cpf: "12345678901" }), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 400);
  });

  test("cria token de cartão com sucesso", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = { findUnique: async () => ({ id: "c1", userId: "u1", panCipher: "cipher", holderName: "U", expMonth: 12, expYear: 2030, brand: "VISA", last4: "1111" }) } as any;
    test.mock.method(vault, "parsePanCipher", () => "cipherObj" as any);
    test.mock.method(vault, "loadVaultKey", () => Buffer.from("a".repeat(32)));
    test.mock.method(vault, "decryptPan", () => "4111111111111111");
    test.mock.method(mpClient, "createCardToken", async () => ({ id: "tok_1", first_six_digits: "411111", last_four_digits: "1111" }));

    const res = await POST(
      makeRequest("http://test/api/account/cards/c1/create-token-backend", { cvv: "123", cpf: "12345678901" }),
      { params: Promise.resolve({ id: "c1" }) } as any,
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, "tok_1");
  });
});
