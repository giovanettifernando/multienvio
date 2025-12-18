import type { Shipment as SrcShipment } from '@/shared/types/shipments';
import type { Shipment } from '@/shared/types/shipment-minimal';
import { labelFromShipment } from '@/shared/utils/label-from-shipment';
import { pushLabelToQueryCache } from '@/modules/labels/application/cache';
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
