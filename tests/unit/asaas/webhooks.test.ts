import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// webhooks.ts -> 'server-only'. Sob node --test (CommonJS puro, fora do bundler do
// Next.js) o import estático de 'server-only' lança. Mesmo padrão de stub já usado em
// tests/unit/asaas/charges.test.ts e cards.test.ts. Como webhooks.ts não tem estado
// por chamada, o stub e o require acontecem uma única vez, de forma síncrona, antes
// dos blocos describe/it (que só rodam depois que o arquivo termina de ser avaliado).
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const WEBHOOKS_PATH = path.resolve(ROOT, 'platform/integrations/asaas/webhooks.ts');

require.cache[SERVER_ONLY_PATH] = { id: SERVER_ONLY_PATH, filename: SERVER_ONLY_PATH, loaded: true, exports: {} } as any;
delete require.cache[WEBHOOKS_PATH];

const { verifyWebhookToken, extractChargeFromPayload, isRelevantEvent } =
  req(WEBHOOKS_PATH) as typeof import('../../../platform/integrations/asaas/webhooks');

const TOKEN = 'a'.repeat(40);

describe('verifyWebhookToken', () => {
  it('aceita quando o token confere', () => {
    assert.equal(verifyWebhookToken(TOKEN, TOKEN), true);
  });

  it('rejeita token diferente', () => {
    assert.equal(verifyWebhookToken('b'.repeat(40), TOKEN), false);
  });

  it('rejeita quando o header não veio', () => {
    assert.equal(verifyWebhookToken(null, TOKEN), false);
  });

  it('rejeita quando não há token configurado — nunca aceitar por omissão', () => {
    assert.equal(verifyWebhookToken(TOKEN, undefined), false);
    assert.equal(verifyWebhookToken(TOKEN, ''), false);
  });

  it('rejeita tokens de tamanhos diferentes sem estourar', () => {
    assert.equal(verifyWebhookToken('curto', TOKEN), false);
  });
});

describe('extractChargeFromPayload', () => {
  it('extrai a cobrança do evento', () => {
    const charge = extractChargeFromPayload({
      id: 'evt_1',
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_1', status: 'CONFIRMED', billingType: 'CREDIT_CARD', value: 10 },
    });
    assert.equal(charge?.id, 'pay_1');
  });

  it('devolve null quando o corpo não tem cobrança', () => {
    assert.equal(extractChargeFromPayload({ id: 'evt_1', event: 'PAYMENT_CONFIRMED' }), null);
    assert.equal(extractChargeFromPayload(null), null);
    assert.equal(extractChargeFromPayload('texto'), null);
  });
});

describe('isRelevantEvent', () => {
  it('aceita eventos que mudam o estado do pagamento', () => {
    for (const evt of [
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_REFUNDED',
      'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
    ]) {
      assert.equal(isRelevantEvent(evt), true, evt);
    }
  });

  it('ignora eventos puramente informativos', () => {
    assert.equal(isRelevantEvent('PAYMENT_CREATED'), false);
    assert.equal(isRelevantEvent('PAYMENT_UPDATED'), false);
  });
});
