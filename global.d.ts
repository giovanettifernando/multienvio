import type { StoredShipment } from '@/shared/types/shipment';

declare global {

  var __envioShipments: Map<string, StoredShipment> | undefined;

  interface Window {
    /** Device fingerprint gerado pelo script de segurança do Mercado Pago */
    MP_DEVICE_SESSION_ID?: string;
  }
}

export {};
