import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/admin/finance/summary/route';
import { prisma } from '@/platform/db/db';
import { contratoFinanceiro, comoFinanceiro, chamar } from '../_contrato';
import { readApi } from '../../../../../../_setup/test-helpers';

const original = { walletTransaction: prisma.walletTransaction, shipment: prisma.shipment, package: prisma.package, wallet: prisma.wallet };

/** Agregados do banco, em centavos (o frete da transportadora vem em reais). */
function banco(v: { topup?: number | null; refund?: number | null; frete?: number | null; seguro?: number | null; repasseReais?: number | null; carteiras?: number | null }) {
  const consultas: any[] = [];
  prisma.walletTransaction = {
    aggregate: async (a: any) => {
      consultas.push(a.where);
      return { _sum: { amountCents: a.where.type === 'TOPUP' ? v.topup ?? null : v.refund ?? null } };
    },
  } as any;
  prisma.shipment = {
    aggregate: async () => ({ _sum: { platformShippingCommissionCents: v.frete ?? null, platformInsuranceCommissionCents: v.seguro ?? null } }),
  } as any;
  prisma.package = { aggregate: async () => ({ _sum: { carrierQuotePrice: v.repasseReais ?? null } }) } as any;
  prisma.wallet = { aggregate: async () => ({ _sum: { availableCents: v.carteiras ?? null } }) } as any;
  return consultas;
}

const rota = { nome: 'app/api/admin/finance/summary', handler: GET as any, url: '/api/admin/finance/summary' };

test.describe('app/api/admin/finance/summary', () => {
  test.beforeEach(() => banco({}));
  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, original);
  });

  contratoFinanceiro(rota);

  test('soma recargas, comissões, repasses e reembolsos', async () => {
    banco({ topup: 100_000, refund: 5_000, frete: 3_000, seguro: 500, repasseReais: 612.345, carteiras: 42_000 });
    comoFinanceiro();

    const res = await readApi(await chamar(rota));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data, {
      period: {},
      grossRevenue: 100_000,
      platformFees: 3_500,
      carrierPayouts: 61_235, // R$ 612,345 arredondado para centavos
      refunds: 5_000,
      chargebacks: 0,
      customersWalletBalance: 42_000,
      platformOperationalBalance: 100_000 - 61_235 - 5_000,
    });
  });

  test('banco sem movimento dá tudo zero', async () => {
    comoFinanceiro();
    const res = await readApi(await chamar(rota));
    assert.strictEqual(res.data.grossRevenue, 0);
    assert.strictEqual(res.data.platformOperationalBalance, 0);
  });

  test('filtra o período no fuso de Brasília', async () => {
    const consultas = banco({});
    comoFinanceiro();

    const res = await readApi(await chamar({ ...rota, url: `${rota.url}?dateStart=2026-01-01&dateEnd=2026-01-31` }));

    assert.deepStrictEqual(res.data.period, { dateStart: '2026-01-01', dateEnd: '2026-01-31' });
    const { gte, lte } = consultas[0].createdAt;
    assert.strictEqual(gte.toISOString(), '2026-01-01T03:00:00.000Z');
    assert.strictEqual(lte.toISOString(), '2026-02-01T02:59:59.999Z');
  });
});
