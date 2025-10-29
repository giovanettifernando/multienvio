export type ShipmentStatus =
  | 'awaiting_dropoff'      // aguardando entrega no ponto de coleta
  | 'awaiting_pickup'       // aguardando coleta no endereço do cliente
  | 'received_at_poc'       // recepcionado no ponto de coleta
  | 'in_pickup'             // em coleta (nossa ou terceiro)
  | 'in_transit'            // em transporte pela transportadora
  | 'exception'             // exceção (endereço, avaria, tentativa, etc.)
  | 'out_for_delivery'      // saiu para entrega
  | 'delivered'             // entregue
  | 'returned';             // devolvido/cancelado

export type PickupType = 'home_pickup' | 'poc_pickup' | 'locker_pickup';
export type CarrierCode = 'Correios' | 'Jadlog' | 'J&T' | 'Loggi' | 'Outro';

export interface OpsShipment {
  id: string;
  customerId: string;
  customerName: string;
  orderRef?: string | null;
  carrier: CarrierCode | null;
  service?: string | null;
  status: ShipmentStatus;
  pickupType: PickupType; // home_pickup (endereço), poc_pickup (ponto)
  pickupAddress?: string | null;
  pocId?: string | null;  // ponto de coleta associado (se houver)
  pocName?: string | null;
  trackingCode?: string | null;
  createdAt: string;      // ISO
  updatedAt: string;      // ISO
  eta?: string | null;    // ETA estimado
  weightKg?: number | null;
  volume?: { w: number; h: number; l: number } | null;
  riskFlag?: boolean;     // antifraude/risco
}

export interface PickupOrder {
  id: string;
  type: PickupType;                  // home_pickup / poc_pickup
  provider: 'internal' | 'third';    // nossa operação ou terceiros
  scheduledFor: string;              // ISO
  window?: { start: string; end: string } | null;
  address: string;
  pocId?: string | null;
  pocName?: string | null;
  capacitySlots?: number | null;     // qte itens na coleta
  status: 'scheduled' | 'en_route' | 'completed' | 'failed' | 'canceled';
  vehicle?: string | null;
  driver?: string | null;
}

export interface PointOfCollection {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  contact?: string | null;
  active: boolean;
  commissionPerItem: number; // R$
  capacityDaily?: number | null;
  itemsAwaiting: number;     // fila atual
  itemsReceivedToday: number;
  monthlyReceived?: number;  // itens recebidos no mês corrente
}

export interface OpsException {
  id: string;
  shipmentId: string;
  createdAt: string;
  type:
    | 'address_issue' | 'not_found' | 'damage' | 'missing_docs'
    | 'pickup_failed' | 'poc_over_capacity' | 'carrier_delay';
  description?: string | null;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  lastUpdate: string;
  assignedTo?: string | null;
  notes?: string | null;
}

export interface OpsSLA {
  metric: 'pickup_time' | 'poc_intake_time' | 'handoff_to_carrier' | 'delivery_time';
  targetHours: number;
  actualHoursAvg: number;
  breachCount: number;
}

export interface OpsEvent {
  id: string;
  source: 'carrier_webhook' | 'poc_checkin' | 'pickup_scan' | 'manual';
  receivedAt: string; // ISO
  shipmentId?: string | null;
  payloadPreview: string;  // texto curto
  processed: boolean;
  retries?: number;
  lastError?: string | null;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;                           // busca livre (cliente, doc, tracking, pedido)
  status?: string;                      // ShipmentStatus|'all'
  pickupType?: string;                  // PickupType|'all'
  carrier?: string;                     // CarrierCode|'all'
  pocId?: string;                       // filtro por ponto de coleta
  dateStart?: string;
  dateEnd?: string;                     // ISO
  riskOnly?: boolean;                   // flag de risco
  type?: string;                        // exception type
  severity?: string;                    // exception severity
  provider?: string;                    // pickup provider
  active?: boolean;                     // PoC active
  city?: string;
  state?: string;
  processed?: boolean;                  // events
  source?: string;                      // events source
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TimelineEvent {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
}
