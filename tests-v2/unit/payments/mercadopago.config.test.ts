import assert from 'node:assert';
import test from 'node:test';
import {
  getMercadoPagoConfig,
  invalidateConfigCache,
  isMercadoPagoConfigured,
  getMercadoPagoPublicKey,
} from '../../../lib/mercadopago/config.ts';
import { prisma } from '../../../lib/db.ts';

const originalEnv = { ...process.env };
const originalPrisma = { paymentGateway: prisma.paymentGateway };

test.describe('mercadopago/config', () => {
  test.afterEach(() => {
    process.env = { ...originalEnv };
    prisma.paymentGateway = originalPrisma.paymentGateway;
    invalidateConfigCache();
  });

  test('usa fallback de env quando não há gateway no banco', async () => {
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = 'pk_test';
    process.env.MP_ACCESS_TOKEN = 'at_test';
    process.env.MP_WEBHOOK_SECRET = 'wh_test';
    process.env.MP_SANDBOX_MODE = 'true';

    prisma.paymentGateway = { findFirst: async () => null } as any;
    invalidateConfigCache();

    const cfg = await getMercadoPagoConfig();
    assert.strictEqual(cfg?.publicKey, 'pk_test');
    assert.strictEqual(cfg?.accessToken, 'at_test');
    assert.strictEqual(cfg?.webhookSecret, 'wh_test');
    assert.strictEqual(cfg?.sandboxMode, true);
    assert.strictEqual(await isMercadoPagoConfigured(), true);
    assert.strictEqual(await getMercadoPagoPublicKey(), 'pk_test');
  });

  test('retorna null se sem env e sem gateway', async () => {
    delete process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    delete process.env.MP_ACCESS_TOKEN;
    prisma.paymentGateway = { findFirst: async () => null } as any;
    invalidateConfigCache();

    const cfg = await getMercadoPagoConfig();
    assert.strictEqual(cfg, null);
    assert.strictEqual(await isMercadoPagoConfigured(), false);
  });

  test('erro ao buscar gateway cai no fallback', async () => {
    delete process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    delete process.env.MP_ACCESS_TOKEN;
    prisma.paymentGateway = { findFirst: async () => { throw new Error('db down'); } } as any;
    invalidateConfigCache();

    const cfg = await getMercadoPagoConfig();
    assert.strictEqual(cfg, null);
  });
});
