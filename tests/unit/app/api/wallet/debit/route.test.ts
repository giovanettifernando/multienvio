import assert from 'node:assert';
import test from 'node:test';
import { POST } from '@/app/api/wallet/debit/route';
import { prisma } from '@/platform/db/db';
import * as sessionModule from '@/modules/auth/application/session';
import * as debitService from '@/modules/wallet/application/debit.service';
import * as mailer from '@/platform/email/mailer';
import { apiRequest, callRoute, readApi } from '../../../../../_setup/test-helpers';

const original = { user: prisma.user, shipment: prisma.shipment };
const debitar = (json: unknown) => callRoute(POST, apiRequest('/api/wallet/debit', { json }));

const resultado = (extra: Record<string, unknown> = {}) => ({
  ok: true,
  idempotent: false,
  balance: 90,
  transactionId: 'wt1',
  ...extra,
});

test.describe('app/api/wallet/debit', () => {
  test.beforeEach(() => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
    test.mock.method(mailer, 'sendShipmentTrackingEmail', async () => true);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, original);
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await debitar({ referenceId: 'r1', amount: 10 }));
    assert.strictEqual(res.status, 401);
  });

  test('recusa valor zero ou negativo', async () => {
    const res = await readApi(await debitar({ referenceId: 'r1', amount: 0 }));
    assert.strictEqual(res.status, 400);
  });

  test('debita sempre na carteira de quem está logado', async () => {
    const debito = test.mock.method(debitService, 'processDebit', async () => resultado());

    const res = await readApi(await debitar({ referenceId: 'r1', amount: 10, userId: 'outro' }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(debito.mock.calls[0].arguments[0].userId, 'u1');
    assert.deepStrictEqual(res.data, { ok: true, idempotent: false, balance: 90, transactionId: 'wt1' });
  });

  test('propaga saldo insuficiente do serviço', async () => {
    const { ApiError } = await import('@/platform/api/errors');
    test.mock.method(debitService, 'processDebit', async () => {
      throw new ApiError({ code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente', status: 400 });
    });
    const res = await readApi(await debitar({ referenceId: 'r1', amount: 10 }));
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.error.code, 'INSUFFICIENT_BALANCE');
  });

  test('avisa o destinatário por e-mail só no primeiro débito', async () => {
    prisma.user = { findUnique: async () => ({ name: 'Loja', razaoSocial: null }) } as any;
    prisma.shipment = {
      findMany: async () => [
        { platformTrackingCode: 'ME1', publicTrackingId: 'p1', recipientName: 'Ana', recipientEmail: 'ana@x.com', destinationCity: 'SP', destinationState: 'SP' },
        { platformTrackingCode: 'ME2', publicTrackingId: 'p2', recipientName: 'Bia', recipientEmail: '', destinationCity: 'RJ', destinationState: 'RJ' },
      ],
    } as any;

    test.mock.method(debitService, 'processDebit', async () => resultado({ shipmentIds: ['s1', 's2'] }));
    await debitar({ referenceId: 'r1', amount: 10 });
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    const envios = (mailer.sendShipmentTrackingEmail as any).mock.calls;
    assert.strictEqual(envios.length, 1, 'destinatário sem e-mail é pulado');
    assert.strictEqual(envios[0].arguments[0], 'ana@x.com');

    test.mock.method(debitService, 'processDebit', async () => resultado({ idempotent: true, shipmentIds: ['s1'] }));
    await debitar({ referenceId: 'r1', amount: 10 });
    await new Promise((r) => setImmediate(r));
    assert.strictEqual((mailer.sendShipmentTrackingEmail as any).mock.callCount(), 1, 'repetição não reenvia');
  });
});
