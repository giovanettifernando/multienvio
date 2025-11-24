import { describe, it, rejects, deepStrictEqual, strictEqual } from 'node:test';
import { createShipmentWithVolumes } from '@/lib/shipments/create-with-volumes';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';

function buildTx() {
  const created: any[] = [];
  return {
    created,
    shipment: {
      create: async (args: any) => {
        const data = { id: 'shp-1', ...args.data };
        created.push({ type: 'shipment', data });
        return data;
      },
    },
    package: {
      create: async (args: any) => {
        const data = { id: `pkg-${Math.random()}`, ...args.data };
        created.push({ type: 'package', data });
        return data;
      },
    },
  };
}

describe('createShipmentWithVolumes', () => {
  it('exige volumes válidos e calcula peso total', async () => {
    const tx = buildTx();
    const { shipment, packages } = await createShipmentWithVolumes(tx as any, {
      shipment: {
        platformTrackingCode: 'BR123',
        senderId: 'user',
        recipientName: 'Dest',
        originCep: '01001000',
        destinationCep: '22290040',
        destinationCity: 'Rio',
        destinationState: 'RJ',
        declaredValue: 0,
        carrier: 'TEST',
        service: 'EXP',
        estimatedDays: 2,
        freightCost: 10,
        status: ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
      },
      volumes: [
        { peso: 1, altura: 10, largura: 10, comprimento: 10 },
        { peso: 2, altura: 20, largura: 10, comprimento: 10 },
      ],
    });

    strictEqual(shipment.weight, 3);
    deepStrictEqual(packages.length, 2);
  });

  it('falha sem volumes ou dimensões inválidas', async () => {
    const tx = buildTx();
    await rejects(
      createShipmentWithVolumes(tx as any, { shipment: {} as any, volumes: [] }),
      /pelo menos 1 volume/i
    );
    await rejects(
      createShipmentWithVolumes(tx as any, {
        shipment: {
          platformTrackingCode: 'BR123',
          senderId: 'u',
          recipientName: 'd',
          originCep: '0',
          destinationCep: '1',
          destinationCity: 'c',
          destinationState: 's',
          declaredValue: 0,
          carrier: 'T',
          service: 'S',
          estimatedDays: 1,
          freightCost: 1,
        },
        volumes: [{ peso: 0, altura: 0, largura: 0, comprimento: 0 }],
      }),
      /INVALID_VOLUME_0/i
    );
  });
});
