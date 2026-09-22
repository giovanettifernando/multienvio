import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/recipient-payment/create/route';
import { prisma } from '@/platform/db/db';
import { ApiError } from '@/platform/api/errors';
import * as sessionModule from '@/modules/auth/application/session';
import * as checkoutService from '@/modules/cart/application/checkout.service';
import * as recipientService from '@/modules/recipients/application/service';
import * as recipientEmail from '@/platform/email/recipient-payment';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const originalUser = prisma.user;

/** Pedido como a tela manda, com o frete adulterado para R$ 0,01. */
function pedidoAdulterado(extra: Record<string, unknown> = {}) {
  return {
    origin: { cep: '01310100', city: 'São Paulo', state: 'SP' },
    destination: { cep: '20040002', city: 'Rio de Janeiro', state: 'RJ' },
    recipient: { name: 'Bruno Lima', email: 'bruno@example.com' },
    packages: [{ packageNumber: 1, width: 16, height: 15, length: 20, weight: 1 }],
    quote: {
      quoteId: 'q1',
      carrier: 'Correios',
      service: 'SEDEX',
      serviceCode: '03220',
      estimatedDays: 1,
      freightCostCents: 1,
      totalCents: 1,
    },
    totalWeight: 1,
    declaredValue: 0,
    ...extra,
  };
}

const criar = (json: unknown) => callRoute(POST, apiRequest('/api/recipient-payment/create', { json }));

test.describe('app/api/recipient-payment/create', () => {
  test.beforeEach(() => {
    test.mock.method(sessionModule, 'getSession', async () => ({ userId: 'u1' }));
    test.mock.method(recipientService, 'createRecipientPaymentRequest', async (input: any) => ({
      id: 'rpr-1',
      paymentToken: 'tok',
      recipientName: input.recipient.name,
      recipientEmail: input.recipient.email,
      totalCents: input.quote.totalCents,
      expiresAt: new Date(),
      packages: input.packages,
    }));
    test.mock.method(recipientEmail, 'sendRecipientPaymentRequestEmail', async () => true);
    prisma.user = { findUnique: async () => ({ name: 'Loja', razaoSocial: null }) } as any;
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.user = originalUser;
  });

  test('exige a cotação de origem do preço', async () => {
    const pedido = pedidoAdulterado();
    const { quoteId: _sem, ...quoteSemId } = pedido.quote;
    const res = await readApi(await criar({ ...pedido, quote: quoteSemId }));
    assert.strictEqual(res.status, 422);
    assert.strictEqual((recipientService.createRecipientPaymentRequest as any).mock.callCount(), 0);
  });

  test('o link cobra o preço e o serviço da cotação salva, não o que a tela mandou', async () => {
    const validar = test.mock.method(checkoutService, 'validateQuoteAndGetPrice', async () => ({
      quoteId: 'q1',
      freightCostCents: 4250,
      freightCost: 42.5,
      estimatedDays: 6,
      carrier: 'Correios',
      service: 'PAC',
      serviceCode: '03298',
    }));

    const res = await readApi(await criar(pedidoAdulterado()));

    assert.strictEqual(res.status, 201, JSON.stringify(res.error));
    assert.deepStrictEqual(validar.mock.calls[0].arguments.slice(0, 3), ['q1', 'u1', 0.01]);
    // o envio vai junto para ser conferido com a cotação
    assert.deepStrictEqual(validar.mock.calls[0].arguments[3], {
      originCep: '01310100',
      destinationCep: '20040002',
      insuranceValue: 0,
      volumes: [{ pesoKg: 1, alturaCm: 15, larguraCm: 16, comprimentoCm: 20 }],
    });
    const { quote } = (recipientService.createRecipientPaymentRequest as any).mock.calls[0].arguments[0];
    assert.deepStrictEqual(quote, {
      quoteId: 'q1',
      carrier: 'Correios',
      service: 'PAC',
      serviceCode: '03298',
      estimatedDays: 6,
      freightCostCents: 4250,
      totalCents: 4250,
    });
  });

  test('cotação de outro usuário ou vencida não gera link', async () => {
    test.mock.method(checkoutService, 'validateQuoteAndGetPrice', async () => {
      throw new ApiError({ code: 'QUOTE_NOT_FOUND', message: 'Cotação não encontrada.', status: 400 });
    });
    const res = await readApi(await criar(pedidoAdulterado()));
    assert.strictEqual(res.status, 400);
    assert.strictEqual((recipientService.createRecipientPaymentRequest as any).mock.callCount(), 0);
  });
});
