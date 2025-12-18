import type { Shipment } from '@/shared/types/shipment-minimal';
import type { LabelItem } from '@/shared/types/label';

/**
 * Adaptador básico para converter um Shipment simplificado em LabelItem
 * Nota: Esta função usa dados mínimos já que o tipo Shipment é básico.
 * Para dados completos de etiqueta, use a API /api/labels que acessa o banco diretamente.
 */
export function labelFromShipment(s: Shipment): LabelItem {
  return {
    id: `LBL-${s.id}`,
    shipmentId: s.id,
    carrier: s.carrier,
    service: s.service,
    status: 'pending',
    price: s.price,
    currency: 'BRL',
    isPrinted: false,
    origin: {
      cep: '',
    },
    destinationCep: '',
    recipient: {
      name: s.recipient?.name ?? 'Destinatário',
      document: s.recipient?.document ?? null,
      city: s.recipient?.city ?? null,
      state: s.recipient?.state ?? null,
    },
    packages: [],
    totalVolumes: 1,
    createdAt: s.createdAt || new Date().toISOString(),
    trackingCode: s.trackingCode ?? null,
    file: null,
  };
}
