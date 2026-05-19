import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(path.resolve(process.cwd(), 'package.json'));

const ROOT = path.resolve(process.cwd());

// Paths that must be stubbed to avoid server-only/DB blowup
const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const CONFIG_PATH = path.resolve(ROOT, 'platform/integrations/pagarme/config.ts');

// Fake prisma stub: paymentGateway.findFirst throws so we fall back to env vars
const fakePrisma = {
  paymentGateway: {
    findFirst: async () => { throw new Error('DB not available in unit test'); },
  },
};

function stubModules() {
  // Stub server-only so it is a no-op
  require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
  // Stub @/platform/db/db to avoid real DB connection
  require.cache[DB_PATH] = { id: DB_PATH, filename: DB_PATH, loaded: true, exports: { prisma: fakePrisma } } as any;
  // Stub encryption service (decrypt is not needed for fallback path)
  require.cache[ENCRYPTION_PATH] = {
    id: ENCRYPTION_PATH,
    filename: ENCRYPTION_PATH,
    loaded: true,
    exports: { decrypt: (v: string) => v, encrypt: (v: string) => v },
  } as any;
}

function clearConfigCache() {
  delete require.cache[CONFIG_PATH];
}

describe('getPagarmeConfig — env fallback', () => {
  before(() => {
    process.env.PAGARME_SECRET_KEY = 'sk_test_abc123';
    process.env.PAGARME_PUBLIC_KEY = 'pk_test_xyz';
    process.env.PAGARME_BASE_URL = 'https://sdx-api.pagar.me/core/v5';
    stubModules();
  });

  after(() => {
    delete process.env.PAGARME_SECRET_KEY;
    delete process.env.PAGARME_PUBLIC_KEY;
    delete process.env.PAGARME_BASE_URL;
    clearConfigCache();
  });

  it('returns config from env vars', async () => {
    clearConfigCache();
    const { getPagarmeConfig, invalidatePagarmeConfigCache } = req(CONFIG_PATH) as typeof import('../../../../../platform/integrations/pagarme/config');
    invalidatePagarmeConfigCache();
    const config = await getPagarmeConfig();
    assert.ok(config === null || typeof config.secretKey === 'string');
  });

  it('returns secretKey matching env var when env is set', async () => {
    clearConfigCache();
    const { getPagarmeConfig, invalidatePagarmeConfigCache } = req(CONFIG_PATH) as typeof import('../../../../../platform/integrations/pagarme/config');
    invalidatePagarmeConfigCache();
    const config = await getPagarmeConfig();
    assert.ok(config !== null);
    assert.strictEqual(config.secretKey, 'sk_test_abc123');
    assert.strictEqual(config.publicKey, 'pk_test_xyz');
    assert.strictEqual(config.sandboxMode, true);
  });
});
