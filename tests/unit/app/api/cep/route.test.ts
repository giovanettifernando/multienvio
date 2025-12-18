import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/cep/route';

test.describe('app/api/cep/route', () => {
  test('retorna found false para CEP inválido', async () => {
    const res = await GET(new Request('http://test/api/cep?cep=123'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.found, false);
  });

  test('retorna CEP formatado quando válido', async () => {
    const res = await GET(new Request('http://test/api/cep?cep=58035100'));
    const body = await res.json();
    assert.strictEqual(body.found, true);
    assert.strictEqual(body.cep, '58035-100');
    assert.strictEqual(body.uf, 'PR');
  });
});
