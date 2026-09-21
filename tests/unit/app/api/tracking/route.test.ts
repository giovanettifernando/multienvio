import assert from 'node:assert';
import test from 'node:test';
import { GET } from '@/app/api/tracking/route';
import { prisma } from '@/platform/db/db';
import * as sessionModule from '@/modules/auth/application/session';
import { apiRequest, callRoute, readApi } from '../../../../_setup/test-helpers';

const originalShipment = prisma.shipment;
const rastrear = (qs = '') => callRoute(GET, apiRequest(`/api/tracking${qs}`));

function envio(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    senderId: 'u1',
    status: 'IN_TRANSIT',
    trackingEvents: [
      { id: 'e2', type: 'DELIVERED', description: 'Entregue', city: 'Recife', uf: 'PE', occurredAt: new Date('2026-03-02T15:00:00Z') },
      { id: 'e1', type: 'PICKED_UP', description: 'Postado', city: null, uf: null, occurredAt: new Date('2026-03-01T10:00:00Z') },
    ],
    ...overrides,
  };
}

test.describe('app/api/tracking', () => {
  test.beforeEach(() => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => ({ userId: 'u1' }));
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    prisma.shipment = originalShipment;
  });

  test('responde 401 sem sessão', async () => {
    test.mock.method(sessionModule, 'getUserFromRequest', async () => null);
    const res = await readApi(await rastrear('?shipmentId=s1'));
    assert.strictEqual(res.status, 401);
  });

  test('responde 400 sem shipmentId', async () => {
    const res = await readApi(await rastrear());
    assert.strictEqual(res.status, 400);
  });

  test('responde 404 para envio inexistente', async () => {
    prisma.shipment = { findUnique: async () => null } as any;
    const res = await readApi(await rastrear('?shipmentId=s1'));
    assert.strictEqual(res.status, 404);
  });

  test('não mostra o rastreio de envio de outro cliente', async () => {
    prisma.shipment = { findUnique: async () => envio({ senderId: 'outro' }) } as any;
    const res = await readApi(await rastrear('?shipmentId=s1'));
    assert.strictEqual(res.status, 403);
  });

  test('devolve os eventos com o status do mais recente', async () => {
    prisma.shipment = { findUnique: async () => envio() } as any;

    const res = await readApi(await rastrear('?shipmentId=s1'));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'DELIVERED');
    assert.deepStrictEqual(res.data.events[1], {
      id: 'e1',
      type: 'PICKED_UP',
      description: 'Postado',
      occurredAt: '2026-03-01T10:00:00.000Z',
    });
  });

  test('sem eventos o status é CREATED; tipo desconhecido vira IN_TRANSIT', async () => {
    prisma.shipment = { findUnique: async () => envio({ trackingEvents: [] }) } as any;
    assert.strictEqual((await readApi(await rastrear('?shipmentId=s1'))).data.status, 'CREATED');

    prisma.shipment = {
      findUnique: async () => envio({ trackingEvents: [{ id: 'e', type: 'ALGO_NOVO', description: '', city: null, uf: null, occurredAt: new Date() }] }),
    } as any;
    assert.strictEqual((await readApi(await rastrear('?shipmentId=s1'))).data.status, 'IN_TRANSIT');
  });
});
