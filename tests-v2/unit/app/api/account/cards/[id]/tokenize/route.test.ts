import assert from "node:assert";
import test from "node:test";
import { POST } from "../../../../../../../../app/api/account/cards/[id]/tokenize/route.ts";
import * as helpers from "../../../../../../../../app/api/account/cards/helpers.ts";
import { prisma } from "../../../../../../../../lib/db.ts";
import * as vault from "../../../../../../../../lib/crypto/card-vault.ts";
import { ApiError } from "../../../../../../../../lib/api/errors.ts";

const originalCard = prisma.card;

function makeRequest(url: string) {
  const req = new Request(url, { method: "POST" });
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    nextUrl: new URL(url),
    json: () => req.json(),
  } as any;
}

test.describe("app/api/account/cards/[id]/tokenize", () => {
  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.card = originalCard;
  });

  test("retorna 404 se cartão não encontrado", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = { findUnique: async () => null } as any;
    const res = await POST(makeRequest("http://test/api/account/cards/c1/tokenize"), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 404);
  });

  test("retorna 404 se panCipher inexistente", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = { findUnique: async () => ({ id: "c1", userId: "u1", panCipher: null }) } as any;
    test.mock.method(vault, "parsePanCipher", () => null);
    const res = await POST(makeRequest("http://test/api/account/cards/c1/tokenize"), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 404);
  });

  test("retorna 500 se vault key ausente", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = { findUnique: async () => ({ id: "c1", userId: "u1", panCipher: "cipher" }) } as any;
    test.mock.method(vault, "parsePanCipher", () => "cipherObj" as any);
    test.mock.method(vault, "loadVaultKey", () => null);
    const res = await POST(makeRequest("http://test/api/account/cards/c1/tokenize"), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 500);
  });

  test("retorna dados para tokenização", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    prisma.card = {
      findUnique: async () => ({
        id: "c1",
        userId: "u1",
        panCipher: "cipher",
        holderName: "User",
        brand: "VISA",
        expMonth: 12,
        expYear: 2030,
        last4: "1111",
      }),
    } as any;
    test.mock.method(vault, "parsePanCipher", () => "cipherObj" as any);
    test.mock.method(vault, "loadVaultKey", () => Buffer.from("a".repeat(32)));
    test.mock.method(vault, "decryptPan", () => "4111111111111111");
    const res = await POST(makeRequest("http://test/api/account/cards/c1/tokenize"), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.pan, "4111111111111111");
    assert.strictEqual(body.data.expYear, 2030);
  });
});
