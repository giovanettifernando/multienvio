import assert from 'node:assert';
import test from 'node:test';
import { swapRouteValues } from '@/shared/utils/swapRouteValues';

test.describe('utils/swapRouteValues', () => {
  test('inverte origem/destino e campos relacionados', () => {
    const calls: any[] = [];
    const form = {
      getValues: () => ({
        origem: { cep: '111', nome: 'A' },
        destino: { cep: '222', nome: 'B' },
        origemCep: '111',
        destinoCep: '222',
        modoOrigem: 'pickup',
        modoDestino: 'delivery',
        remetenteRecorrenteId: 'rem',
        destinatarioRecorrenteId: 'dest',
        extra: 'x',
      }),
      reset: (values: any) => calls.push(values),
    };

    swapRouteValues(form as any);
    const [resetValues] = calls;
    assert.deepStrictEqual(resetValues.origem, { cep: '222', nome: 'B' });
    assert.deepStrictEqual(resetValues.destino, { cep: '111', nome: 'A' });
    assert.strictEqual(resetValues.origemCep, '222');
    assert.strictEqual(resetValues.destinoCep, '111');
    assert.strictEqual(resetValues.modoOrigem, 'delivery');
    assert.strictEqual(resetValues.modoDestino, 'pickup');
    assert.strictEqual(resetValues.remetenteRecorrenteId, 'dest');
    assert.strictEqual(resetValues.destinatarioRecorrenteId, 'rem');
    assert.strictEqual(resetValues.extra, 'x');
  });

  test('mantém campos opcionais ausentes sem erro', () => {
    const form = {
      getValues: () => ({ origem: null, destino: null }),
      reset: () => {},
    };
    assert.doesNotThrow(() => swapRouteValues(form as any));
  });
});
