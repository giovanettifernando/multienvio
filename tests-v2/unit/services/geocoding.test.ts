import assert from 'node:assert';
import test from 'node:test';
import { geocodeCEP } from '../../../lib/services/geocoding.ts';

const originalFetch = global.fetch;

test.describe('services/geocoding', () => {
  test.afterEach(() => {
    global.fetch = originalFetch;
  });

  test('retorna erro para CEP inválido', async () => {
    const res = await geocodeCEP('123');
    assert.strictEqual(res.success, false);
  });

  test('usa cache após primeira chamada', async () => {
    let calls = 0;
    global.fetch = (async (url: any) => {
      calls += 1;
      if (String(url).includes('brasilapi')) {
        return {
          ok: true,
          json: async () => ({
            street: 'Rua',
            neighborhood: 'Centro',
            city: 'Curitiba',
            state: 'PR',
          }),
        } as any;
      }
      // Nominatim
      return {
        ok: true,
        json: async () => [{ lat: '1', lon: '2' }],
      } as any;
    }) as any;

    const first = await geocodeCEP('12345678');
    assert.strictEqual(first.success, true);
    const second = await geocodeCEP('12345678');
    assert.strictEqual(second.success, true);
    assert.strictEqual(calls, 2); // brasilapi + nominatim only first invocation
  });
});
