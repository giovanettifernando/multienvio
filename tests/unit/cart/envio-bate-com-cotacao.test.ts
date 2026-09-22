import assert from 'node:assert';
import test from 'node:test';
import { conferirEnvioComCotacao } from '@/modules/cart/application/cotacao-envio';

const cotacao = {
  originCep: '01310100',
  destCep: '20040002',
  insuranceValue: 100,
  volumes: [
    { weight: 1.5, height: 15, width: 16, length: 20 },
    { weight: 3, height: 30, width: 20, length: 40 },
  ],
};

const envioIgual = {
  originCep: '01310-100',
  destinationCep: '20040-002',
  insuranceValue: 100,
  volumes: [
    { pesoKg: 1.5, alturaCm: 15, larguraCm: 16, comprimentoCm: 20 },
    { pesoKg: 3, alturaCm: 30, larguraCm: 20, comprimentoCm: 40 },
  ],
};

const recusa = (envio: object, motivo: RegExp) =>
  assert.throws(
    () => conferirEnvioComCotacao(cotacao, { ...envioIgual, ...envio }),
    (e: any) => e.status === 400 && e.code === 'QUOTE_MISMATCH' && motivo.test(e.message)
  );

test.describe('envio precisa bater com a cotação', () => {
  test('envio igual ao cotado passa (CEP com ou sem hífen)', () => {
    assert.doesNotThrow(() => conferirEnvioComCotacao(cotacao, envioIgual));
  });

  test('mais leve, menor ou com seguro menor passa: sai mais barato', () => {
    assert.doesNotThrow(() =>
      conferirEnvioComCotacao(cotacao, {
        ...envioIgual,
        insuranceValue: 0,
        volumes: [
          { pesoKg: 1, alturaCm: 10, larguraCm: 16, comprimentoCm: 20 },
          { pesoKg: 2.5, alturaCm: 30, larguraCm: 20, comprimentoCm: 40 },
        ],
      })
    );
  });

  test('CEP de origem ou destino diferente é recusado', () => {
    recusa({ originCep: '04101300' }, /CEP de origem/);
    recusa({ destinationCep: '69005000' }, /CEP de destino/);
  });

  test('quantidade de volumes diferente é recusada', () => {
    recusa({ volumes: envioIgual.volumes.slice(0, 1) }, /volumes/);
  });

  test('volume mais pesado que o cotado é recusado', () => {
    recusa(
      { volumes: [envioIgual.volumes[0], { ...envioIgual.volumes[1], pesoKg: 30 }] },
      /volume 2.*peso/i
    );
  });

  test('volume maior que o cotado é recusado', () => {
    recusa(
      { volumes: [{ ...envioIgual.volumes[0], comprimentoCm: 80 }, envioIgual.volumes[1]] },
      /volume 1.*medidas/i
    );
  });

  test('declarar valor maior que o cotado é recusado', () => {
    recusa({ insuranceValue: 10_000 }, /valor declarado/i);
  });

  test('cotação antiga sem valor segurado vale como zero', () => {
    assert.throws(() => conferirEnvioComCotacao({ ...cotacao, insuranceValue: null }, envioIgual));
    assert.doesNotThrow(() => conferirEnvioComCotacao({ ...cotacao, insuranceValue: null }, { ...envioIgual, insuranceValue: 0 }));
  });

  test('arredondamento de centavos e gramas não recusa', () => {
    assert.doesNotThrow(() =>
      conferirEnvioComCotacao(cotacao, {
        ...envioIgual,
        insuranceValue: 100.004,
        volumes: [{ ...envioIgual.volumes[0], pesoKg: 1.504 }, envioIgual.volumes[1]],
      })
    );
  });
});
