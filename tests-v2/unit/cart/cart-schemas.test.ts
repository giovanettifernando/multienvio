import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addCartItemSchema, updateCartItemSchema, checkoutCartSchema } from '../../../lib/validation/cart.ts';

const basePayload = {
  originAddress: {
    logradouro: 'Rua A',
    numero: '123',
    bairro: 'Centro',
    cidade: 'SP',
    uf: 'SP',
    cep: '01001000',
  },
  destination: {
    logradouro: 'Rua B',
    numero: '456',
    bairro: 'Centro',
    cidade: 'RJ',
    uf: 'RJ',
    cep: '22290040',
  },
  volumes: [
    { comprimentoCm: 10, larguraCm: 10, alturaCm: 10, pesoKg: 1 },
  ],
  preferences: { pickupRequested: false },
  selectedQuote: { carrier: 'TEST', serviceName: 'EXPRESS', price: 10, deadlineDays: 2 },
  totals: { total: 10, moeda: 'BRL' },
};

describe('cart validation schemas', () => {
  it('aceita payload mínimo válido para adicionar item', () => {
    const parsed = addCartItemSchema.parse(basePayload);
    assert.strictEqual(parsed.totals.total, 10);
  });

  it('recusa payload inválido (volume faltando peso)', () => {
    let error: Error | null = null;
    try {
      addCartItemSchema.parse({
        ...basePayload,
        volumes: [{ comprimentoCm: 10, larguraCm: 10, alturaCm: 10 }],
      });
    } catch (e) {
      error = e as Error;
    }
    assert.ok(error instanceof Error);
  });

  it('checkoutCartSchema aceita lista opcional de items', () => {
    const parsed = checkoutCartSchema.parse({ itemIds: ['1', '2'], paymentMethod: 'wallet' });
    assert.strictEqual(parsed.itemIds?.length, 2);
  });

  it('updateCartItemSchema permite campos parciais', () => {
    const parsed = updateCartItemSchema.parse({
      destination: { ...basePayload.destination, numero: '999' },
      totals: { total: 20, moeda: 'BRL' },
    });
    assert.strictEqual(parsed.totals?.total, 20);
  });
});
