import assert from 'node:assert';
import test from 'node:test';
import {
  mapCarrierEventToShipmentStatus,
  applyCarrierEventToShipment,
  applyCarrierEventsBatch,
  normalizeEventCode,
  validateCarrierEvent,
} from '../../../lib/shipments/carrier-events-handler.ts';
import { ShipmentStatus } from '../../../lib/shipments/shipment-status.ts';
import { prisma } from '../../../lib/db.ts';

const baseEvent = {
  eventCode: 'BDE',
  description: 'Objeto encaminhado',
  occurredAt: new Date('2024-01-01T10:00:00Z'),
  carrier: 'correios',
} as const;

test.describe('carrier-events-handler', () => {
  const originalPrisma = {
    shipment: prisma.shipment,
    trackingEvent: prisma.trackingEvent,
    $transaction: prisma.$transaction,
  };

  test.afterEach(() => {
    prisma.shipment = originalPrisma.shipment;
    prisma.trackingEvent = originalPrisma.trackingEvent;
    prisma.$transaction = originalPrisma.$transaction;
  });

  test('mapCarrierEventToShipmentStatus cobre código, descrição, keywords e fallback null', () => {
    assert.strictEqual(
      mapCarrierEventToShipmentStatus({ ...baseEvent, eventCode: 'BDE' }),
      ShipmentStatus.IN_TRANSFER
    );
    assert.strictEqual(
      mapCarrierEventToShipmentStatus({ ...baseEvent, eventCode: 'UNK', description: 'Saiu para entrega' }),
      ShipmentStatus.OUT_FOR_DELIVERY
    );
    assert.strictEqual(
      mapCarrierEventToShipmentStatus({ ...baseEvent, eventCode: 'UNK', description: 'Problema na entrega' }),
      ShipmentStatus.DELIVERY_PROBLEM
    );
    assert.strictEqual(
      mapCarrierEventToShipmentStatus({ ...baseEvent, eventCode: 'UNK', description: 'Algo sem mapeamento' }),
      null
    );
  });

  test('applyCarrierEventToShipment atualiza status e tracking', async () => {
    let shipmentUpdated: any = null;
    let trackingCreated: any = null;

    prisma.shipment = {
      findUnique: async () => ({ id: 's1', status: ShipmentStatus.IN_TRANSFER, platformTrackingCode: 'BR1' }),
      update: async ({ data }: any) => {
        shipmentUpdated = data;
        return { id: 's1', status: data.status };
      },
    } as any;

    prisma.trackingEvent = {
      create: async ({ data }: any) => {
        trackingCreated = data;
        return data;
      },
    } as any;

    prisma.$transaction = async (cb: any) => cb({ shipment: prisma.shipment, trackingEvent: prisma.trackingEvent });

    const result = await applyCarrierEventToShipment('s1', { ...baseEvent, eventCode: 'ODS', description: 'Saiu para entrega' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.newStatus, ShipmentStatus.OUT_FOR_DELIVERY);
    assert.deepStrictEqual(shipmentUpdated, { status: ShipmentStatus.OUT_FOR_DELIVERY });
    assert.strictEqual(trackingCreated?.description, 'Saiu para entrega');
  });

  test('applyCarrierEventToShipment retorna erro quando não encontra shipment ou evento não mapeado', async () => {
    prisma.shipment = { findUnique: async () => null } as any;
    const noShipment = await applyCarrierEventToShipment('missing', { ...baseEvent, eventCode: 'ODS' });
    assert.strictEqual(noShipment.success, false);
    assert.strictEqual(noShipment.message, 'Shipment não encontrado');

    prisma.shipment = {
      findUnique: async () => ({ id: 's2', status: ShipmentStatus.IN_TRANSFER, platformTrackingCode: 'BR2' }),
    } as any;
    prisma.$transaction = async () => { throw new Error('db fail'); };
    const dbError = await applyCarrierEventToShipment('s2', { ...baseEvent, eventCode: 'UNK', description: '??' });
    assert.strictEqual(dbError.success, false);
  });

  test('applyCarrierEventsBatch propaga resultados', async () => {
    prisma.shipment = {
      findUnique: async () => ({ id: 's1', status: ShipmentStatus.IN_TRANSFER, platformTrackingCode: 'BR1' }),
      update: async () => ({}),
    } as any;
    prisma.trackingEvent = { create: async () => ({}) } as any;
    prisma.$transaction = async (cb: any) => cb({ shipment: prisma.shipment, trackingEvent: prisma.trackingEvent });

    const results = await applyCarrierEventsBatch([
      { shipmentId: 's1', event: { ...baseEvent, eventCode: 'BDE', description: 'Em transferência' } },
      { shipmentId: 's1', event: { ...baseEvent, eventCode: 'UNK', description: '??' } },
    ]);

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].success, true);
    assert.strictEqual(results[1].success, false);
  });

  test('normalizeEventCode e validateCarrierEvent', () => {
    assert.strictEqual(normalizeEventCode(' bde  '), 'BDE');
    const valid = validateCarrierEvent({ ...baseEvent });
    assert.strictEqual(valid.valid, true);
    assert.deepStrictEqual(valid.errors, []);

    const invalid = validateCarrierEvent({ eventCode: '', description: '', carrier: '', occurredAt: null as any });
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.errors.some((e) => e.includes('eventCode')));
    assert.ok(invalid.errors.some((e) => e.includes('description')));
    assert.ok(invalid.errors.some((e) => e.includes('carrier')));
    assert.ok(invalid.errors.some((e) => e.includes('ocurredAt') || e.includes('occurredAt')));
  });
});
