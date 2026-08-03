import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

// cards.ts -> client.ts -> 'server-only', e client.ts -> config.ts -> @/platform/db/db
// (conexão real com o banco no escopo do módulo). Sob node --test (CommonJS puro,
// fora do bundler do Next.js) isso lança/quebra no import estático. Mesmo padrão de
// stub já usado em tests/unit/asaas/charges.test.ts (Task 4) e customers.test.ts (Task 3).
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
const ROOT = path.resolve(process.cwd());

const SERVER_ONLY_PATH = req.resolve('server-only');
const DB_PATH = path.resolve(ROOT, 'platform/db/db.ts');
const ENCRYPTION_PATH = path.resolve(ROOT, 'platform/integrations/shared/encryption.service.ts');
const CARDS_PATH = path.resolve(ROOT, 'platform/integrations/asaas/cards.ts');

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
  delete require.cache[CARDS_PATH];
});

function loadCards() {
  return req(CARDS_PATH) as typeof import('../../../platform/integrations/asaas/cards');
}

function fakeRequest() {
  const calls: Array<{ path: string; body: any }> = [];
  const request = async (path: string, options: RequestInit = {}) => {
    calls.push({ path, body: JSON.parse(options.body as string) });
    return {
      creditCardNumber: '8829',
      creditCardBrand: 'MASTERCARD',
      creditCardToken: 'tok_abc',
    };
  };
  return { request: request as never, calls };
}

const input = {
  customerId: 'cus_1',
  holderName: 'CLIENTE TESTE',
  number: '5162 3062 1937 8829',
  expiryMonth: 12,
  expiryYear: 2030,
  ccv: '318',
  remoteIp: '203.0.113.7',
  holder: {
    name: 'Cliente Teste',
    email: 'teste@enviolegal.com.br',
    cpfCnpj: '249.715.637-92',
    postalCode: '89223-005',
    addressNumber: '277',
    phone: '(47) 3801-0919',
  },
};

describe('tokenizeCard', () => {
  it('envia o cartão sem pontuação e devolve o token', async () => {
    const { tokenizeCard } = loadCards();
    const { request, calls } = fakeRequest();
    const result = await tokenizeCard(input, { request });

    assert.equal(result.creditCardToken, 'tok_abc');
    assert.equal(result.creditCardNumber, '8829');
    assert.equal(calls[0].path, '/v3/creditCard/tokenizeCreditCard');
    assert.equal(calls[0].body.creditCard.number, '5162306219378829');
    assert.equal(calls[0].body.creditCard.expiryMonth, '12');
    assert.equal(calls[0].body.creditCard.expiryYear, '2030');
    assert.equal(calls[0].body.creditCardHolderInfo.cpfCnpj, '24971563792');
    assert.equal(calls[0].body.creditCardHolderInfo.postalCode, '89223005');
    assert.equal(calls[0].body.remoteIp, '203.0.113.7');
  });

  it('exige o IP do cliente', async () => {
    const { tokenizeCard } = loadCards();
    const { request } = fakeRequest();
    await assert.rejects(
      () => tokenizeCard({ ...input, remoteIp: '' }, { request }),
      /remoteIp é obrigatório/i,
    );
  });
});
