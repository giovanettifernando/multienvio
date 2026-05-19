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

function stubModules() {
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: {} } } as any;
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
}

before(() => {
  stubModules();
  // Clear client module cache so stubs are in place before first load
  delete require.cache[CONFIG_PATH];
  delete require.cache[CLIENT_PATH];
});

describe('buildBasicAuthHeader', () => {
  it('encodes sk:empty as base64', () => {
    const { buildBasicAuthHeader } = req(CLIENT_PATH) as typeof import('../../../../../platform/integrations/pagarme/client');
    const header = buildBasicAuthHeader('sk_test_abc');
    const expected = 'Basic ' + Buffer.from('sk_test_abc:').toString('base64');
    assert.strictEqual(header, expected);
  });
});

describe('mapOrderStatus', () => {
  it('maps order.paid to PAID', () => {
    const { mapOrderStatus } = req(CLIENT_PATH) as typeof import('../../../../../platform/integrations/pagarme/client');
    assert.strictEqual(mapOrderStatus('order.paid'), 'PAID');
  });
  it('maps order.payment_failed to FAILED', () => {
    const { mapOrderStatus } = req(CLIENT_PATH) as typeof import('../../../../../platform/integrations/pagarme/client');
    assert.strictEqual(mapOrderStatus('order.payment_failed'), 'FAILED');
  });
  it('maps charge.pending to PENDING', () => {
    const { mapOrderStatus } = req(CLIENT_PATH) as typeof import('../../../../../platform/integrations/pagarme/client');
    assert.strictEqual(mapOrderStatus('charge.pending'), 'PENDING');
  });
  it('maps charge.refunded to REFUNDED', () => {
    const { mapOrderStatus } = req(CLIENT_PATH) as typeof import('../../../../../platform/integrations/pagarme/client');
    assert.strictEqual(mapOrderStatus('charge.refunded'), 'REFUNDED');
  });
  it('returns PENDING for unknown event', () => {
    const { mapOrderStatus } = req(CLIENT_PATH) as typeof import('../../../../../platform/integrations/pagarme/client');
    assert.strictEqual(mapOrderStatus('unknown.event'), 'PENDING');
  });
});
