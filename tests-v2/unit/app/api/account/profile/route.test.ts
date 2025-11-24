import assert from 'node:assert';
import test from 'node:test';
import { GET, PUT } from '../../../../../../app/api/account/profile/route.ts';

const originalFetch = global.fetch;

test.describe('app/api/account/profile', () => {
  test.afterEach(() => {
    global.fetch = originalFetch;
  });

  test('GET propaga erro quando /me falha', async () => {
    global.fetch = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'unauth' }),
    })) as any;
    const res = await GET(new Request('http://test/api/account/profile'));
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.message, 'unauth');
  });

  test('GET transforma user em Profile', async () => {
    global.fetch = (async () => ({
      ok: true,
      json: async () => ({
        success: true,
        user: {
          name: 'User',
          email: 'a@b.com',
          phone: '123',
          cpf: '000',
          hasCompany: true,
          cnpj: '11',
          razaoSocial: 'Empresa',
          avatarUrl: 'url',
        },
      }),
    })) as any;

    const res = await GET(new Request('http://test/api/account/profile'));
    const body = await res.json();
    assert.strictEqual(body.fullName, 'User');
    assert.strictEqual(body.company.cnpj, '11');
  });

  test('PUT envia payload transformado e propaga erro', async () => {
    const calls: any[] = [];
    global.fetch = (async (_url: any, init: any) => {
      calls.push(JSON.parse(init.body));
      return {
        ok: false,
        status: 400,
        json: async () => ({ message: 'fail' }),
      };
    }) as any;

    const res = await PUT(
      new Request('http://test/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName: 'New Name', phone: '999' }),
      }),
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(calls[0].name, 'New Name');
  });

  test('PUT retorna Profile salvo', async () => {
    global.fetch = (async (_url: any, init: any) => {
      const sent = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          user: {
            name: sent.name,
            email: 'a@b.com',
            phone: sent.phone,
            cpf: null,
            hasCompany: false,
            avatarUrl: null,
          },
        }),
      };
    }) as any;

    const res = await PUT(
      new Request('http://test/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName: 'Saved', phone: '123' }),
      }),
    );
    const body = await res.json();
    assert.strictEqual(body.fullName, 'Saved');
    assert.strictEqual(body.email, 'a@b.com');
  });
});
