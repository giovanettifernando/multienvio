import assert from 'node:assert';
import test from 'node:test';
import { GET, POST } from '@/app/api/account/cards/route';
import * as helpers from '@/app/api/account/cards/helpers';
import * as service from '@/modules/auth/application/account-cards.service';
import * as validation from '@/shared/validation/card';
import { ApiError } from '@/platform/api/errors';

function makeRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  return {
    ...req,
    headers: req.headers,
    method: req.method,
    json: () => req.json(),
    nextUrl: new URL(url),
  } as any;
}

test.describe('app/api/account/cards', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('GET falha sem userId', async () => {
    test.mock.method(helpers, 'requireUserId', async () => {
      throw new ApiError({ code: 'unauthorized', message: 'no auth', status: 401 });
    });
    const res = await GET(makeRequest('http://test/api/account/cards'), { params: Promise.resolve({} as any) } as any);
    assert.strictEqual(res.status, 401);
  });

  test('GET lista cartões paginados', async () => {
    test.mock.method(helpers, 'requireUserId', async () => 'u1');
    test.mock.method(service, 'listUserCards', async () => ({
      items: [{ id: 'c1', holderName: 'User', last4: '1111', brand: 'VISA', expMonth: 12, expYear: 2030, isDefault: true, billingAddressId: null, createdAt: new Date() }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }));
    const res = await GET(makeRequest('http://test/api/account/cards?page=1&pageSize=20'), { params: Promise.resolve({} as any) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.items[0].id, 'c1');
    assert.strictEqual(body.meta.tags[0], 'account');
  });

  test('POST retorna 400 se payload inválido', async () => {
    test.mock.method(helpers, 'requireUserId', async () => 'u1');
    test.mock.method(helpers, 'enforceCardWriteLimit', () => {});
    test.mock.method(validation, 'validateCardCreateInput', () => {
      const err: any = new validation.CardValidationError('invalid_payload', 'bad');
      throw err;
    });
    const res = await POST(
      makeRequest('http://test/api/account/cards', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } }),
      { params: Promise.resolve({} as any) } as any,
    );
    assert.strictEqual(res.status, 400);
  });

  test('POST cria cartão', async () => {
    test.mock.method(helpers, 'requireUserId', async () => 'u1');
    test.mock.method(helpers, 'enforceCardWriteLimit', () => {});
    test.mock.method(validation, 'validateCardCreateInput', () => ({
      pan: '4111111111111111',
      brand: 'VISA',
      holderName: 'User',
      expMonth: 12,
      expYear: 2030,
      last4: '1111',
      requestDefault: true,
    }));
    test.mock.method(service, 'createUserCard', async () => ({
      id: 'c1',
      holderName: 'User',
      last4: '1111',
      brand: 'VISA',
      expMonth: 12,
      expYear: 2030,
      isDefault: true,
      billingAddressId: null,
      createdAt: new Date(),
    }));

    const res = await POST(
      makeRequest('http://test/api/account/cards', { method: 'POST', body: JSON.stringify({}), headers: { 'content-type': 'application/json' } }),
      { params: Promise.resolve({} as any) } as any,
    );
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.data.id, 'c1');
  });
});
