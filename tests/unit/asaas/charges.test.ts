import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// charges.ts -> client.ts -> 'server-only', e client.ts -> config.ts -> @/platform/db/db
// (conexão real com o banco no escopo do módulo). Sob node --test (CommonJS puro,
// fora do bundler do Next.js) isso lança/quebra no import estático. Mesmo padrão de
// stub já usado em tests/unit/asaas/customers.test.ts (Task 3) e client.test.ts (Task 2).
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const CHARGES_PATH = path.resolve(ROOT, 'platform/integrations/asaas/charges.ts');

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
  delete require.cache[CHARGES_PATH];
});

function loadCharges() {
  return req(CHARGES_PATH) as typeof import('../../../platform/integrations/asaas/charges');
}

function fakeRequest(response: unknown = { id: 'pay_1', status: 'PENDING' }) {
  const calls: Array<{ path: string; method?: string; body: any }> = [];
  const request = async (path: string, options: RequestInit = {}) => {
    calls.push({
      path,
      method: options.method,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    });
    return response;
  };
  return { request: request as never, calls };
}

const base = {
  customerId: 'cus_1',
  amountCents: 4990,
  description: 'Envio',
  referenceId: 'el_abc',
  dueDate: '2026-08-05',
};

describe('createCharge', () => {
  it('envia valor em reais, não em centavos', async () => {
    const { createCharge } = loadCharges();
    const { request, calls } = fakeRequest();
    await createCharge({ ...base, paymentMethod: 'pix' }, { request });

    assert.equal(calls[0].path, '/v3/payments');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.value, 49.9);
    assert.equal(calls[0].body.billingType, 'PIX');
    assert.equal(calls[0].body.externalReference, 'el_abc');
  });

  it('gera boleto com o billingType correto', async () => {
    const { createCharge } = loadCharges();
    const { request, calls } = fakeRequest();
    await createCharge({ ...base, paymentMethod: 'boleto' }, { request });

    assert.equal(calls[0].body.billingType, 'BOLETO');
    assert.equal(calls[0].body.creditCardToken, undefined);
  });

  it('cobra cartão salvo enviando token e IP do cliente', async () => {
    const { createCharge } = loadCharges();
    const { request, calls } = fakeRequest();
    await createCharge(
      { ...base, paymentMethod: 'credit_card', cardToken: 'tok_1', remoteIp: '203.0.113.7' },
      { request },
    );

    assert.equal(calls[0].body.billingType, 'CREDIT_CARD');
    assert.equal(calls[0].body.creditCardToken, 'tok_1');
    assert.equal(calls[0].body.remoteIp, '203.0.113.7');
  });

  it('parcela usando totalValue em vez de value', async () => {
    const { createCharge } = loadCharges();
    const { request, calls } = fakeRequest();
    await createCharge(
      {
        ...base,
        amountCents: 30000,
        paymentMethod: 'credit_card',
        cardToken: 'tok_1',
        remoteIp: '203.0.113.7',
        installments: 3,
      },
      { request },
    );

    assert.equal(calls[0].body.installmentCount, 3);
    assert.equal(calls[0].body.totalValue, 300);
    assert.equal(calls[0].body.value, undefined, 'value e totalValue são mutuamente exclusivos');
  });

  it('recusa cartão sem token', async () => {
    const { createCharge } = loadCharges();
    const { request } = fakeRequest();
    await assert.rejects(
      () => createCharge({ ...base, paymentMethod: 'credit_card', remoteIp: '203.0.113.7' }, { request }),
      /cartão exige creditCardToken/i,
    );
  });

  it('recusa cartão sem IP do cliente', async () => {
    const { createCharge } = loadCharges();
    const { request } = fakeRequest();
    await assert.rejects(
      () => createCharge({ ...base, paymentMethod: 'credit_card', cardToken: 'tok_1' }, { request }),
      /remoteIp é obrigatório/i,
    );
  });
});

describe('refundCharge', () => {
  it('estorna o valor total quando não informado', async () => {
    const { refundCharge } = loadCharges();
    const { request, calls } = fakeRequest({ id: 'pay_1', status: 'REFUNDED' });
    await refundCharge('pay_1', undefined, { request });

    assert.equal(calls[0].path, '/v3/payments/pay_1/refund');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, {});
  });

  it('estorna parcialmente convertendo centavos para reais', async () => {
    const { refundCharge } = loadCharges();
    const { request, calls } = fakeRequest({ id: 'pay_1', status: 'PARTIALLY_REFUNDED' });
    await refundCharge('pay_1', 1500, { request });

    assert.equal(calls[0].body.value, 15);
  });
});
