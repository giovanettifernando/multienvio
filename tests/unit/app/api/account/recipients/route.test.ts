import assert from 'node:assert';
import test from 'node:test';
import { GET, POST } from '@/app/api/account/recipients/route';
import * as helpers from '@/app/api/account/recipients/helpers';
import * as service from '@/modules/auth/application/account-recipients.service';
// Mock no módulo de origem: shared/validation/recipient só reexporta (getter não é mockável)
import * as validation from '@/modules/recipients/dto/recipient';

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

test.describe('app/api/account/recipients', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('GET retorna 401 se requireUserId falha', async () => {
    test.mock.method(helpers, 'requireUserId', async () => {
      throw new (await import('../../../../../../platform/api/errors.ts')).ApiError({
        code: 'unauthorized',
        message: 'no auth',
        status: 401,
      });
    });
    const res = await GET(makeRequest('http://test/api/account/recipients'), { params: Promise.resolve({} as any) } as any);
    assert.strictEqual(res.status, 401);
  });

  test('GET lista destinatários', async () => {
    test.mock.method(helpers, 'requireUserId', async () => 'u1');
    test.mock.method(service, 'listRecipients', async () => ({
      items: [{ id: 'r1', name: 'Dest', city: 'Cidade', uf: 'SP', cep: '12345678' }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }));
    const res = await GET(makeRequest('http://test/api/account/recipients?q=d'), { params: Promise.resolve({} as any) } as any);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.items[0].id, 'r1');
  });

  test('POST retorna 400 quando validação falha', async () => {
    test.mock.method(helpers, 'requireUserId', async () => 'u1');
    test.mock.method(helpers, 'enforceRecipientWriteLimit', () => {});
    test.mock.method(validation, 'validateRecipientCreateInput', () => {
      const err: any = new validation.RecipientValidationError('invalid_payload', 'bad');
      throw err;
    });
    const res = await POST(
      makeRequest('http://test/api/account/recipients', { method: 'POST', body: JSON.stringify({}), headers: { 'content-type': 'application/json' } }),
      { params: Promise.resolve({} as any) } as any,
    );
    assert.strictEqual(res.status, 400);
  });

  test('POST cria destinatário', async () => {
    test.mock.method(helpers, 'requireUserId', async () => 'u1');
    test.mock.method(helpers, 'enforceRecipientWriteLimit', () => {});
    test.mock.method(validation, 'validateRecipientCreateInput', () => ({ name: 'Dest', document: '123', city: 'Cidade' }));
    test.mock.method(service, 'createRecipient', async () => ({ id: 'r1', name: 'Dest' }));
    const res = await POST(
      makeRequest('http://test/api/account/recipients', { method: 'POST', body: JSON.stringify({}), headers: { 'content-type': 'application/json' } }),
      { params: Promise.resolve({} as any) } as any,
    );
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.data.id, 'r1');
  });
});
