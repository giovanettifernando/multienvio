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
const WEBHOOKS_PATH = path.resolve(ROOT, 'platform/integrations/pagarme/webhooks.ts');

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: {} } } as any;
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
  require.cache[ORDERS_PATH] = {
    id: ORDERS_PATH,
    filename: ORDERS_PATH,
    loaded: true,
    exports: {
      getOrder: async (id: string) => ({ id }),
      createOrder: async () => ({}),
      processOrderData: () => ({}),
    },
  } as any;
}

before(() => {
  stubModules();
  delete require.cache[CONFIG_PATH];
  delete require.cache[CLIENT_PATH];
  delete require.cache[WEBHOOKS_PATH];
});

describe('extractOrderIdFromPayload', () => {
  it('returns data.id when it starts with or_ (order event)', () => {
    const { extractOrderIdFromPayload } = req(WEBHOOKS_PATH) as typeof import('../../../../../platform/integrations/pagarme/webhooks');
    const orderPayload = {
      id: 'hook_abc',
      type: 'order.paid',
      created_at: '',
      data: {
        id: 'or_abc',
        status: 'paid',
        amount: 100,
        charges: [],
        created_at: '',
        updated_at: '',
      },
    };
    assert.strictEqual(extractOrderIdFromPayload(orderPayload as any), 'or_abc');
  });

  it('returns data.order.id when payload is a charge event', () => {
    const { extractOrderIdFromPayload } = req(WEBHOOKS_PATH) as typeof import('../../../../../platform/integrations/pagarme/webhooks');
    const chargePayload = {
      id: 'hook_abc',
      type: 'charge.refunded',
      created_at: '',
      data: {
        id: 'ch_abc',
        status: 'canceled',
        amount: 100,
        payment_method: 'credit_card',
        last_transaction: { id: 'tran_abc', status: 'refunded' },
        order: { id: 'or_parent' },
      },
    };
    assert.strictEqual(extractOrderIdFromPayload(chargePayload as any), 'or_parent');
  });
});
