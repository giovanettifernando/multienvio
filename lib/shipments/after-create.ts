import type { Shipment as SrcShipment } from '@/src/types/shipments';
import type { Shipment } from '@/lib/types/shipment';
import { labelFromShipment } from '@/lib/adapters/label-from-shipment';
import { pushLabelToQueryCache } from '@/lib/labels/cache';
import { QueryClient } from '@tanstack/react-query';

/**
 * Converte o tipo Shipment de /src/types para /lib/types
 */
function adaptShipment(srcShipment: SrcShipment): Shipment {
  return {
    id: srcShipment.id,
    carrier: srcShipment.carrierName,
    service: srcShipment.serviceName,
    price: srcShipment.freightValue,
    currency: 'BRL',
    recipient: {
      name: srcShipment.recipientName,
      document: null,
      city: srcShipment.recipientCityUf?.split('/')?.[0] ?? null,
      state: srcShipment.recipientCityUf?.split('/')?.[1] ?? null,
    },
    createdAt: srcShipment.createdAt,
    trackingCode: srcShipment.trackingCode ?? null,
  };
}

export function afterShipmentCreated(qc: QueryClient, shipment: SrcShipment) {
  const adaptedShipment = adaptShipment(shipment);
  const label = labelFromShipment(adaptedShipment);
  pushLabelToQueryCache(qc, label);
}
