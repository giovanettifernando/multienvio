import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/cep/[cep]/route';
import * as cepModule from '@/platform/integrations/correios/cep';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const consultar = (cep: string) => callRoute(GET, apiRequest(`/api/cep/${cep}`), { cep });

const endereco = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  complemento: '',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP',
  source: 'correios',
};

test.describe('app/api/cep/[cep]', () => {
  test.afterEach(() => test.mock.restoreAll());

  test('recusa CEP sem 8 dígitos sem consultar ninguém', async () => {
    const consulta = test.mock.method(cepModule, 'consultarCep', async () => endereco);
    const res = await readApi(await consultar('123'));
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error.code, 'invalid_cep');
    assert.strictEqual(consulta.mock.callCount(), 0);
  });

  test('aceita CEP com hífen e consulta só os dígitos', async () => {
    const consulta = test.mock.method(cepModule, 'consultarCep', async () => ({ ...endereco, extra: 'x' }));

    const res = await readApi(await consultar('01310-100'));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(consulta.mock.calls[0].arguments[0], '01310100');
    assert.deepStrictEqual(res.data, endereco);
  });

  test('CEP inexistente vira 404', async () => {
    test.mock.method(cepModule, 'consultarCep', async () => {
      throw new cepModule.CepError('CEP não encontrado', 'NOT_FOUND');
    });
    const res = await readApi(await consultar('99999999'));
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.error.code, 'not_found');
  });

  test('Correios e BrasilAPI fora do ar vira 503', async () => {
    test.mock.method(cepModule, 'consultarCep', async () => {
      throw new cepModule.CepError('Serviço indisponível', 'SERVICE_UNAVAILABLE');
    });
    const res = await readApi(await consultar('01310100'));
    assert.strictEqual(res.status, 503);
  });
});
