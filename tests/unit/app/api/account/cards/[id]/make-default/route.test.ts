import assert from "node:assert";
import test from "node:test";
import { POST } from '@/app/api/account/cards/[id]/make-default/route';
import * as helpers from '@/app/api/account/cards/helpers';
import * as service from '@/modules/auth/application/account-cards.service';
import { ApiError } from '@/platform/api/errors';

function makeRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  return {
    ...req,
    url,
    headers: req.headers,
    method: req.method,
    nextUrl: new URL(url),
    json: () => req.json(),
  } as any;
}

test.describe("app/api/account/cards/[id]/make-default", () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test("retorna 401 quando requireUserId falha", async () => {
    test.mock.method(helpers, "requireUserId", async () => {
      throw new ApiError({ code: "unauthorized", message: "no auth", status: 401 });
    });
    const res = await POST(makeRequest("http://test/api/account/cards/c1/make-default"), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 401);
  });

  test("marca cartão como default", async () => {
    test.mock.method(helpers, "requireUserId", async () => "u1");
    test.mock.method(helpers, "enforceCardWriteLimit", () => {});
    test.mock.method(service, "makeUserCardDefault", async () => ({
      id: "c1",
      holderName: "User",
      brand: "VISA",
      last4: "1111",
      expMonth: 12,
      expYear: 2030,
      isDefault: true,
      billingAddressId: null,
      createdAt: new Date(),
    }));
    const res = await POST(makeRequest("http://test/api/account/cards/c1/make-default"), { params: Promise.resolve({ id: "c1" }) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, "c1");
    assert.strictEqual(body.data.isDefault, true);
  });
});
