import { describe, it } from 'node:test';
import {
  migrateLegacyStatus,
  canBeCancelled,
  getNextCancellationStatus,
  processCancellationBeforeHandoff,
  processCancellationInTransit,
} from '@/modules/shipments/application/status-migration';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import assert from 'node:assert/strict';

describe('shipments - status migration', () => {
  it('migra status legado com contexto de pickup', () => {
    assert.strictEqual(
      migrateLegacyStatus('criado', { pickupPointId: 'point' }),
      ShipmentStatus.AWAITING_DROP_OFF_AT_POINT
    );
    assert.strictEqual(
      migrateLegacyStatus('cancelled', { pickupRequestStatus: 'PENDING' }),
      ShipmentStatus.CANCELLED_BEFORE_HANDOFF
    );
  });

  it('determina cancelabilidade e próximo status', () => {
    assert.strictEqual(canBeCancelled(ShipmentStatus.AWAITING_DROP_OFF_AT_POINT), true);
    assert.strictEqual(
      getNextCancellationStatus(ShipmentStatus.AWAITING_DROP_OFF_AT_POINT),
      ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
    );
    assert.strictEqual(
      processCancellationBeforeHandoff(ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF),
      ShipmentStatus.CANCELLED_BEFORE_HANDOFF
    );
  });

  it('processa cancelamento em trânsito', () => {
    assert.strictEqual(
      processCancellationInTransit(ShipmentStatus.IN_TRANSIT_TO_DESTINATION, 'request'),
      ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT
    );
    assert.strictEqual(
      processCancellationInTransit(ShipmentStatus.IN_TRANSIT_TO_DESTINATION, 'returning'),
      ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING
    );
  });

  it('rejeita passo inválido', () => {
    assert.throws(
      () => processCancellationInTransit(ShipmentStatus.IN_TRANSIT_TO_DESTINATION, 'invalid' as any),
      /inválido/i
    );
  });
});
