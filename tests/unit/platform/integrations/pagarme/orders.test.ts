import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(path.resolve(process.cwd(), 'package.json'));

const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const CONFIG_PATH = path.resolve(ROOT, 'platform/integrations/pagarme/config.ts');
const CLIENT_PATH = path.resolve(ROOT, 'platform/integrations/pagarme/client.ts');
const ORDERS_PATH = path.resolve(ROOT, 'platform/integrations/pagarme/orders.ts');

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: {} } } as any;
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
  require.cache[CONFIG_PATH] = {
    id: CONFIG_PATH,
    filename: CONFIG_PATH,
    loaded: true,
    exports: { getPagarmeConfig: async () => null },
  } as any;
  require.cache[CLIENT_PATH] = {
    id: CLIENT_PATH,
    filename: CLIENT_PATH,
    loaded: true,
    exports: {
      pagarmeRequest: async () => ({}),
      buildBasicAuthHeader: () => '',
      mapOrderStatus: () => 'PENDING',
    },
  } as any;
}

before(() => {
  stubModules();
  delete require.cache[ORDERS_PATH];
});

function makeOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'or_abc',
    status: 'paid',
    amount: 5000,
    charges: [
      {
        id: 'ch_abc',
        status: 'paid',
        amount: 5000,
        paid_amount: 5000,
        payment_method: 'credit_card',
        last_transaction: { id: 'tran_abc', status: 'paid' },
      },
    ],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('processOrderData', () => {
  it('paid credit_card order → status=PAID, amountCents=5000, method=CREDIT_CARD', () => {
    const { processOrderData } = req(ORDERS_PATH) as typeof import('../../../../../platform/integrations/pagarme/orders');
    const order = makeOrder() as any;
    const result = processOrderData(order);
    assert.strictEqual(result.externalId, 'or_abc');
    assert.strictEqual(result.status, 'PAID');
    assert.strictEqual(result.amountCents, 5000);
    assert.strictEqual(result.method, 'CREDIT_CARD');
    assert.strictEqual(result.chargeId, 'ch_abc');
    assert.ok(result.paidAt instanceof Date);
  });

  it('PIX pending order → status=PENDING, method=PIX, pixQrCode and pixQrCodeUrl set', () => {
    const { processOrderData } = req(ORDERS_PATH) as typeof import('../../../../../platform/integrations/pagarme/orders');
    const order = makeOrder({
      status: 'pending',
      charges: [
        {
          id: 'ch_pix',
          status: 'pending',
          amount: 3000,
          paid_amount: 0,
          payment_method: 'pix',
          last_transaction: {
            id: 'tran_pix',
            status: 'waiting_payment',
            qr_code: 'qr_code_string',
            qr_code_url: 'https://pix.example.com/qr.png',
          },
        },
      ],
      amount: 3000,
    }) as any;
    const result = processOrderData(order);
    assert.strictEqual(result.status, 'PENDING');
    assert.strictEqual(result.method, 'PIX');
    assert.strictEqual(result.pixQrCode, 'qr_code_string');
    assert.strictEqual(result.pixQrCodeUrl, 'https://pix.example.com/qr.png');
    assert.strictEqual(result.paidAt, undefined);
  });

  it('credit_card order with card details → cardBrand and cardLast4 extracted', () => {
    const { processOrderData } = req(ORDERS_PATH) as typeof import('../../../../../platform/integrations/pagarme/orders');
    const order = makeOrder({
      charges: [
        {
          id: 'ch_card',
          status: 'paid',
          amount: 5000,
          paid_amount: 5000,
          payment_method: 'credit_card',
          last_transaction: {
            id: 'tran_card',
            status: 'paid',
            card: {
              id: 'card_xyz',
              brand: 'visa',
              last_four_digits: '4242',
              first_six_digits: '411111',
              holder_name: 'Test User',
              exp_month: 12,
              exp_year: 2028,
              status: 'active',
            },
          },
        },
      ],
    }) as any;
    const result = processOrderData(order);
    assert.strictEqual(result.cardBrand, 'VISA');
    assert.strictEqual(result.cardLast4, '4242');
  });
});
