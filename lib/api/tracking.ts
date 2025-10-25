export type TrackingEvent = {
  code: string;
  description: string;
  at: string;         // ISO date
  location: string;
};

export type TrackingPayload = {
  shipmentId: string;
  status: 'in_transit' | 'delivered' | 'delayed';
  events: TrackingEvent[];
  updatedAt: string;
};

export function ensureTracking(shipmentId: string): TrackingPayload {
  const seed = Array.from(shipmentId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const statuses: TrackingPayload['status'][] = ['in_transit', 'delivered', 'delayed'];
  const status = statuses[seed % statuses.length];

  const now = new Date();
  const minus = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  const events: TrackingEvent[] = [
    { code: 'POSTED', description: 'Objeto postado', at: minus(4), location: 'Origem' },
    { code: 'HUB_IN', description: 'Recebido no centro de distribuição', at: minus(3), location: 'CD Regional' },
    { code: 'IN_TRANSIT', description: 'Em trânsito para próxima unidade', at: minus(2), location: 'Rota' },
    status === 'delivered'
      ? { code: 'DELIVERED', description: 'Objeto entregue ao destinatário', at: minus(1), location: 'Destino' }
      : { code: 'OUT_FOR_DELIVERY', description: 'Saiu para entrega', at: minus(1), location: 'CD Destino' },
  ];

  return {
    shipmentId,
    status,
    events,
    updatedAt: new Date().toISOString(),
  };
}
