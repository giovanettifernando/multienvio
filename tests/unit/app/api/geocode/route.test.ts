import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/geocode/route';
import * as geocoding from '@/platform/integrations/shared/geocoding';
import { apiRequest, callRoute, readApi } from '../../../../_setup/test-helpers';

const geocodificar = (qs = '') => callRoute(GET, apiRequest(`/api/geocode${qs}`));

test.describe('app/api/geocode', () => {
  test.afterEach(() => test.mock.restoreAll());

  test('responde 400 sem CEP', async () => {
    const res = await readApi(await geocodificar());
    assert.strictEqual(res.status, 400);
  });

  test('repassa a mensagem do geocodificador quando falha', async () => {
    test.mock.method(geocoding, 'geocodeCEP', async () => ({ success: false, error: 'CEP não localizado' }));
    const res = await readApi(await geocodificar('?cep=00000000'));
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error.message, 'CEP não localizado');
  });

  test('devolve as coordenadas', async () => {
    test.mock.method(geocoding, 'geocodeCEP', async () => ({ success: true, coordinates: { lat: -7.1, lng: -34.8 } }));
    const res = await readApi(await geocodificar('?cep=58035100'));
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data, { cep: '58035100', coordinates: { lat: -7.1, lng: -34.8 } });
  });
});
