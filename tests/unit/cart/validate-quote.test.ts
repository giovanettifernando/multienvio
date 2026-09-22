import assert from 'node:assert';
import test from 'node:test';
import { prisma } from '@/platform/db/db';
import { validateQuoteAndGetPrice } from '@/modules/cart/application/checkout.service';

const originalQuote = prisma.quote;

function cotacaoSalva(extra: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    userId: 'u1',
    originCep: '01310100',
    destCep: '20040002',
    insuranceValue: '0.00',
    expiresAt: new Date(Date.now() + 3600_000),
    selection: { optionId: 'o1', totalCents: 2590, deliveryDays: 5, carrierName: 'Correios', serviceName: 'PAC' },
    options: [{ id: 'o1', serviceId: '03298', metadata: null }],
    volumes: [{ weight: '1.00', height: 15, width: 16, length: 20 }],
    ...extra,
  };
}

const envio = {
  originCep: '01310100',
  destinationCep: '20040002',
  insuranceValue: 0,
  volumes: [{ pesoKg: 1, alturaCm: 15, larguraCm: 16, comprimentoCm: 20 }],
};

test.describe('validateQuoteAndGetPrice', () => {
  test.afterEach(() => {
    prisma.quote = originalQuote;
  });

  test('envio igual ao cotado: devolve o preço e o serviço da cotação', async () => {
    let consulta: any;
    prisma.quote = { findFirst: async (a: any) => { consulta = a; return cotacaoSalva(); } } as any;

    const r = await validateQuoteAndGetPrice('q1', 'u1', 0.01, envio);

    assert.deepStrictEqual(consulta.where, { id: 'q1', userId: 'u1' });
    assert.ok(consulta.include.volumes, 'precisa trazer os volumes cotados');
    assert.strictEqual(r.freightCostCents, 2590);
    assert.strictEqual(r.serviceCode, '03298');
  });

  test('cotação de 1 kg SP→RJ não paga 30 kg para Manaus', async () => {
    prisma.quote = { findFirst: async () => cotacaoSalva() } as any;

    await assert.rejects(
      validateQuoteAndGetPrice('q1', 'u1', undefined, {
        ...envio,
        destinationCep: '69005000',
        volumes: [{ pesoKg: 30, alturaCm: 15, larguraCm: 16, comprimentoCm: 20 }],
      }),
      (e: any) => e.code === 'QUOTE_MISMATCH'
    );
  });

  test('cotação sem seguro não paga envio com R$ 10.000 declarados', async () => {
    prisma.quote = { findFirst: async () => cotacaoSalva() } as any;
    await assert.rejects(
      validateQuoteAndGetPrice('q1', 'u1', undefined, { ...envio, insuranceValue: 10_000 }),
      (e: any) => e.code === 'QUOTE_MISMATCH'
    );
  });
});
