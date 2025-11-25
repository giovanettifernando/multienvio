import assert from "node:assert";
import test from "node:test";
import { POST } from "../../../../../../../../app/api/account/recipients/[id]/make-default/route.ts";
import * as helpers from "../../../../../../../../app/api/account/recipients/helpers.ts";
import * as service from "../../../../../../../../lib/services/account-recipients.service.ts";
import { ApiError } from "../../../../../../../../lib/api/errors.ts";
import { ApiError } from "../../../../../../../lib/api/errors.ts";

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

test.describe("app/api/account/recipients/[id]/make-default", () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("retorna 401 quando requireUserId falha", async () => {
    test.mock.method(helpers, "requireUserId", async () => {
      throw new ApiError({ code: "unauthorized", message: "no auth", status: 401 });
    });
    const res = await POST(makeRequest("http://test/api/account/recipients/r1/make-default"), { params: Promise.resolve({ id: "r1" }) } as any);
    assert.strictEqual(res.status, 401);
  });

  test("define destinatário como default", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    test.mock.method(helpers, "enforceRecipientWriteLimit", () => {});
    test.mock.method(service, "makeRecipientDefault", async () => ({ id: "r1", name: "Rec", isDefault: true }));
    const res = await POST(makeRequest("http://test/api/account/recipients/r1/make-default"), { params: Promise.resolve({ id: "r1" }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, "r1");
    assert.strictEqual(body.data.isDefault, true);
  });
});
