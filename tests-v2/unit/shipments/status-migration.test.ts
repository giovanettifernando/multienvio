import { describe, it, strictEqual, rejects } from 'node:test';
import {
  migrateLegacyStatus,
  canBeCancelled,
  getNextCancellationStatus,
  processCancellationBeforeHandoff,
  processCancellationInTransit,
} from '@/lib/shipments/status-migration';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';

describe('shipments - status migration', () => {
  it('migra status legado com contexto de pickup', () => {
    strictEqual(
      migrateLegacyStatus('criado', { pickupPointId: 'point' }),
      ShipmentStatus.AWAITING_DROP_OFF_AT_POINT
    );
    strictEqual(
      migrateLegacyStatus('cancelled', { pickupRequestStatus: 'PENDING' }),
      ShipmentStatus.CANCELLED_BEFORE_HANDOFF
    );
  });

  it('determina cancelabilidade e próximo status', () => {
    strictEqual(canBeCancelled(ShipmentStatus.AWAITING_DROP_OFF_AT_POINT), true);
    strictEqual(
      getNextCancellationStatus(ShipmentStatus.AWAITING_DROP_OFF_AT_POINT),
      ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
    );
    strictEqual(
      processCancellationBeforeHandoff(ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF),
      ShipmentStatus.CANCELLED_BEFORE_HANDOFF
    );
  });

  it('processa cancelamento em trânsito', () => {
    strictEqual(
      processCancellationInTransit(ShipmentStatus.IN_TRANSIT_TO_DESTINATION, 'request'),
      ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT
    );
    strictEqual(
      processCancellationInTransit(ShipmentStatus.IN_TRANSIT_TO_DESTINATION, 'returning'),
      ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING
    );
  });

  it('rejeita passo inválido', async () => {
    await rejects(
      () => Promise.resolve(processCancellationInTransit(ShipmentStatus.IN_TRANSIT_TO_DESTINATION, 'invalid' as any)),
      /inválido/i
    );
  });
});
