import assert from 'node:assert';
import test from 'node:test';
import {
  mapToUIStatus,
  getStatusLabel,
  getBackendStatusesForUIFilter,
} from '@/modules/shipments/application/status-labels-map';
import {
  ShipmentStatus,
  ShipmentStatusLabels,
} from '@/modules/shipments/application/shipment-status';

test.describe('shipments/status-labels-map', () => {
  test('mapToUIStatus cobre todos os grupos e fallback', () => {
    // Coleta
    assert.strictEqual(mapToUIStatus(ShipmentStatus.PICKUP_REQUESTED), 'Aguardando coleta');
    assert.strictEqual(mapToUIStatus(ShipmentStatus.PICKUP_FAILED), 'Cancelado');
    // Em trânsito
    assert.strictEqual(mapToUIStatus(ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB), 'Em trânsito');
    // Ponto de coleta
    assert.strictEqual(mapToUIStatus(ShipmentStatus.AWAITING_DROP_OFF_AT_POINT), 'Aguardando postagem');
    // Postado
    assert.strictEqual(mapToUIStatus(ShipmentStatus.RECEIVED_AT_ORIGIN_HUB), 'Postado');
    // Transporte/entrega
    assert.strictEqual(mapToUIStatus(ShipmentStatus.IN_TRANSIT_TO_DESTINATION), 'Em trânsito');
    assert.strictEqual(mapToUIStatus(ShipmentStatus.OUT_FOR_DELIVERY), 'Em rota de entrega');
    assert.strictEqual(mapToUIStatus(ShipmentStatus.DELIVERED), 'Entregue');
    // Problemas de entrega
    assert.strictEqual(mapToUIStatus(ShipmentStatus.DELIVERY_ATTEMPT_FAILED), 'Em rota de entrega');
    // Cancelamento
    assert.strictEqual(mapToUIStatus(ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF), 'Cancelado');
    // Devolução
    assert.strictEqual(mapToUIStatus(ShipmentStatus.RETURNED_TO_SENDER), 'Devolvido');
    // Fallback
    const warnSpy: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnSpy.push(msg);
    const fallback = mapToUIStatus('UNKNOWN' as ShipmentStatus);
    console.warn = originalWarn;
    assert.strictEqual(fallback, 'Em trânsito');
    assert.ok(warnSpy.some((msg) => msg.includes('Status desconhecido')));
  });

  test('getStatusLabel retorna label amigável ou status bruto', () => {
    assert.strictEqual(getStatusLabel(ShipmentStatus.DELIVERED), ShipmentStatusLabels[ShipmentStatus.DELIVERED]);
    assert.strictEqual(getStatusLabel('UNKNOWN' as ShipmentStatus), 'UNKNOWN');
  });

  test('getBackendStatusesForUIFilter cobre todos os filtros e default vazio', () => {
    assert.ok(getBackendStatusesForUIFilter('Aguardando coleta').includes(ShipmentStatus.PICKUP_REQUESTED));
    assert.ok(getBackendStatusesForUIFilter('Aguardando postagem').includes(ShipmentStatus.AWAITING_DROP_OFF_AT_POINT));
    assert.ok(getBackendStatusesForUIFilter('Postado').includes(ShipmentStatus.RECEIVED_AT_ORIGIN_HUB));
    assert.ok(getBackendStatusesForUIFilter('Em trânsito').includes(ShipmentStatus.IN_TRANSIT_TO_DESTINATION));
    assert.ok(getBackendStatusesForUIFilter('Em rota de entrega').includes(ShipmentStatus.OUT_FOR_DELIVERY));
    assert.ok(getBackendStatusesForUIFilter('Entregue').includes(ShipmentStatus.DELIVERED));
    assert.ok(getBackendStatusesForUIFilter('Cancelado').includes(ShipmentStatus.CANCELLED_BEFORE_HANDOFF));
    assert.ok(getBackendStatusesForUIFilter('Devolvido').includes(ShipmentStatus.RETURNED_TO_SENDER));
    assert.deepStrictEqual(getBackendStatusesForUIFilter('Outro' as any), []);
  });
});
