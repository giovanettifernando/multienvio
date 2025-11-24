import assert from 'node:assert';
import test from 'node:test';
import { mapToPublicTrackingStatus, PublicStatusMessages, TrackingPublicStatus } from '../../../lib/shipments/public-tracking-status.ts';
import { ShipmentStatus } from '../../../lib/shipments/shipment-status.ts';

test.describe('shipments/public-tracking-status', () => {
  test('mapeia todas as fases para status público', () => {
    // Aguardando postagem
    [
      ShipmentStatus.PICKUP_REQUESTED,
      ShipmentStatus.PICKUP_FAILED,
      ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
      ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
    ].forEach((st) => assert.strictEqual(mapToPublicTrackingStatus(st), TrackingPublicStatus.AGUARDANDO_POSTAGEM));

    // Postado origem
    [
      ShipmentStatus.COLLECTED_FROM_SENDER,
      ShipmentStatus.COLLECTED_FROM_POINT,
      ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
      ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
    ].forEach((st) => assert.strictEqual(mapToPublicTrackingStatus(st), TrackingPublicStatus.POSTADO_ORIGEM));

    // Em trânsito / destino / rota
    assert.strictEqual(mapToPublicTrackingStatus(ShipmentStatus.IN_TRANSFER), TrackingPublicStatus.EM_TRANSITO);
    assert.strictEqual(mapToPublicTrackingStatus(ShipmentStatus.AT_DESTINATION_HUB), TrackingPublicStatus.EM_DESTINO);
    assert.strictEqual(mapToPublicTrackingStatus(ShipmentStatus.OUT_FOR_DELIVERY), TrackingPublicStatus.EM_ROTA_ENTREGA);

    // Disponível retirada
    [
      ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
      ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
    ].forEach((st) => assert.strictEqual(mapToPublicTrackingStatus(st), TrackingPublicStatus.DISPONIVEL_RETIRADA));

    // Tentativa não realizada
    [
      ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
      ShipmentStatus.DELIVERY_PROBLEM,
    ].forEach((st) => assert.strictEqual(mapToPublicTrackingStatus(st), TrackingPublicStatus.TENTATIVA_NAO_REALIZADA));

    // Entregue
    assert.strictEqual(mapToPublicTrackingStatus(ShipmentStatus.DELIVERED), TrackingPublicStatus.ENTREGUE);

    // Retornando / devolvido
    [
      ShipmentStatus.RETURNING_TO_SENDER,
      ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
      ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING,
    ].forEach((st) => assert.strictEqual(mapToPublicTrackingStatus(st), TrackingPublicStatus.RETORNANDO_REMETENTE));

    [
      ShipmentStatus.RETURNED_TO_SENDER,
      ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
    ].forEach((st) => assert.strictEqual(mapToPublicTrackingStatus(st), TrackingPublicStatus.DEVOLVIDO_REMETENTE));

    // Cancelado
    [
      ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
      ShipmentStatus.EXPIRED_NOT_POSTED,
    ].forEach((st) => assert.strictEqual(mapToPublicTrackingStatus(st), TrackingPublicStatus.ENVIO_CANCELADO));
  });

  test('possui mensagens públicas definidas para todos status públicos', () => {
    const statuses = Object.values(TrackingPublicStatus);
    statuses.forEach((st) => {
      const msg = PublicStatusMessages[st];
      assert.ok(msg);
      assert.ok(msg.title.length > 0);
      assert.ok(msg.description.length > 0);
    });
  });
});
