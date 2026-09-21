import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addCartItemSchema } from '@/shared/validation/cart';

const basePayload = {
  quoteId: 'q1',
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

  it('recusa item sem a cotação de onde sai o preço', () => {
    const { quoteId: _sem, ...semCotacao } = basePayload;
    assert.strictEqual(addCartItemSchema.safeParse(semCotacao).success, false);
  });
});
