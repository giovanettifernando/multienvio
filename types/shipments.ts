export type ShipmentStatus =
  | "Aguardando coleta"
  | "Postado"
  | "Em trânsito"
  | "Em rota de entrega"
  | "Entregue";

export type Shipment = {
  id: string;
  trackingCode: string;
  recipientName: string;
  recipientCityUf: string;
  serviceName: string;
  etaDays: number;
  freightValue: number;
  status: ShipmentStatus;
  createdAt: string;
};

