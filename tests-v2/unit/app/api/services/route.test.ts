import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../../../../../app/api/services/route.ts';

test.describe('app/api/services/route', () => {
  test('retorna lista de serviços de envio', async () => {
    const res = await GET();
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.services));
    const codes = body.services.map((s: any) => s.code);
    assert.ok(codes.includes('CORREIOS_SEDEX'));
  });
});
