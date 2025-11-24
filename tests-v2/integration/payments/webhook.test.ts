import { describe, it, strictEqual, afterEach } from 'node:test';
import { mock } from 'node:test';
import { POST as webhookHandler } from '@/app/api/webhooks/mercadopago/route';
import * as mp from '@/lib/mercadopago';

afterEach(() => mock.restoreAll());

describe('webhooks/mercadopago', () => {
  it('retorna 200 quando processWebhook succeed', async () => {
    mock.method(mp, 'processWebhook', async () => true);
    const req = new Request('http://test/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ id: '1', type: 'payment', data: { id: 'p1' } }),
    });
    const res = await webhookHandler(req);
    strictEqual(res.status, 200);
  });

  it('retorna 400 quando processWebhook falha', async () => {
    mock.method(mp, 'processWebhook', async () => false);
    const req = new Request('http://test/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ id: '1', type: 'payment', data: { id: 'p1' } }),
    });
    const res = await webhookHandler(req);
    strictEqual(res.status, 400);
  });
});
