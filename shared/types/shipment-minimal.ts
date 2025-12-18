export interface Shipment {
  id: string;
  carrier: string;
  service: string;
  price: number;
  currency: 'BRL';
  recipient: {
    name: string;
    document?: string | null;
    city?: string | null;
    state?: string | null;
  };
  createdAt: string; // ISO
  trackingCode?: string | null;
}
