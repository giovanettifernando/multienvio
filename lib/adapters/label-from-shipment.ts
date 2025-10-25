import type { Shipment } from '@/lib/types/shipment';
import type { LabelItem } from '@/lib/types/label';

export function labelFromShipment(s: Shipment): LabelItem {
  return {
    id: `LBL-${s.id}`,
    shipmentId: s.id,
    carrier: s.carrier,
    service: s.service,
    status: 'pending',            // ainda sem PDF; pode virar 'issued' quando houver file
    price: s.price,
    currency: 'BRL',
    recipient: {
      name: s.recipient?.name ?? 'Destinatário',
      document: s.recipient?.document ?? null,
      city: s.recipient?.city ?? null,
      state: s.recipient?.state ?? null,
    },
    createdAt: s.createdAt || new Date().toISOString(),
    trackingCode: s.trackingCode ?? null,
    file: null,                   // sem PDF no front; preview fica desativado
  };
}
