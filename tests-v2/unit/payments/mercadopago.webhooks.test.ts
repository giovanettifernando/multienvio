import { describe, it } from 'node:test';
import crypto from 'crypto';
import { validateWebhookSignature } from '../../../lib/mercadopago/webhooks.ts';
import { invalidateConfigCache } from '../../../lib/mercadopago/config.ts';
import type { MercadoPagoWebhookPayload } from '../../../lib/mercadopago/index.ts';
import assert from 'node:assert/strict';

const payload: MercadoPagoWebhookPayload = {
  id: 1,
  action: 'payment.updated',
  type: 'payment',
  data: { id: 'pay-1' },
  date_created: new Date().toISOString(),
  api_version: 'v1',
  user_id: 123,
  live_mode: false,
};

describe('mercadopago webhooks - validateWebhookSignature', () => {
  it('retorna true para assinatura válida dentro da janela', async () => {
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = 'pk_test';
    process.env.MP_ACCESS_TOKEN = 'at_test';
    process.env.MP_WEBHOOK_SECRET = 'secret-key';
    invalidateConfigCache();

    const ts = Math.floor(Date.now() / 1000);
    const manifest = `id:${payload.data?.id};request-id:req-1;ts:${ts};`;
    const signature = crypto.createHmac('sha256', 'secret-key').update(manifest).digest('hex');

    const headers = {
      'x-signature': `ts=${ts},v1=${signature}`,
      'x-request-id': 'req-1',
    };

    const result = await validateWebhookSignature(payload, headers);
    assert.strictEqual(result, true);
  });

  it('falha quando headers obrigatórios estão ausentes', async () => {
    process.env.MP_WEBHOOK_SECRET = 'secret-key';
    invalidateConfigCache();
    const result = await validateWebhookSignature(payload, {
      'x-signature': undefined,
      'x-request-id': undefined,
    });
    assert.strictEqual(result, false);
  });

  it('falha quando timestamp está expirado', async () => {
    process.env.MP_WEBHOOK_SECRET = 'secret-key';
    invalidateConfigCache();
    const ts = Math.floor((Date.now() - 10 * 60 * 1000) / 1000); // 10 min atrás
    const manifest = `id:${payload.data?.id};request-id:req-1;ts:${ts};`;
    const signature = crypto.createHmac('sha256', 'secret-key').update(manifest).digest('hex');

    const headers = {
      'x-signature': `ts=${ts},v1=${signature}`,
      'x-request-id': 'req-1',
    };

    const result = await validateWebhookSignature(payload, headers);
    assert.strictEqual(result, false);
  });
});
