import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../../../../../app/api/geocode/route.ts';
import * as geocoding from '../../../../../lib/services/geocoding.ts';

test.describe('app/api/geocode/route', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('retorna 400 quando cep ausente', async () => {
    const res = await GET(new Request('http://test/api/geocode'));
    assert.strictEqual(res.status, 400);
  });

  test('retorna erro do geocoder quando falha', async () => {
    test.mock.method(geocoding, 'geocodeCEP', async () => ({ success: false, error: 'fail' }));
    const res = await GET(new Request('http://test/api/geocode?cep=12345678'));
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.message, 'fail');
  });

  test('retorna coordenadas quando sucesso', async () => {
    test.mock.method(geocoding, 'geocodeCEP', async () => ({
      success: true,
      coordinates: { lat: 1, lng: 2 },
      precision: 'zipcode',
    }));
    const res = await GET(new Request('http://test/api/geocode?cep=12345678'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.coordinates, { lat: 1, lng: 2 });
  });
});
