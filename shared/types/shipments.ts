/**
 * Status simplificados para UI
 * Alinhado com UIShipmentStatus de lib/shipments/status-labels-map.ts
 */
export type ShipmentStatus =
  | "Aguardando coleta"
  | "Aguardando postagem"
  | "Postado"
  | "Em trânsito"
  | "Em rota de entrega"
  | "Problema na entrega"
  | "Entregue"
  | "Cancelado"
  | "Devolvido";

export type Shipment = {
  id: string;                 // internal id
  trackingCode: string;       // BR123456789BR ...
  recipientName: string;      // Nome do destinatário
  recipientCityUf: string;    // Curitiba/PR
  carrierName: string;        // Transportadora
  serviceName: string;        // Expresso, Econômico...
  etaDays: number;            // prazo estimado (dias)
  expectedDeliveryDate?: string; // ISO — data prevista de entrega
  freightValue: number;       // R$
  status: ShipmentStatus;
  createdAt: string;          // ISO
  postedAt: string | null;    // ISO — data de postagem (null = não postado)
  labelUrl?: string;          // URL da etiqueta (stub)
  trackingUrl?: string;       // URL de rastreio externo (stub)
  hasVolumeDivergence?: boolean; // Flag para alerta de divergência
};
