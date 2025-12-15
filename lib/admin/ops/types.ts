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
  platformTrackingCode: string;
  carrierTrackingCode?: string | null;
  senderId: string;
  senderName: string;
  senderEmail?: string | null;
  recipientId?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientDocument?: string | null;
  destinationAddress?: string | null;
  destinationNeighborhood?: string | null;
  destinationCity: string;
  destinationState: string;
  destinationCep: string;
  originCep: string;
  weight: number;
  declaredValue: number;
  status: string;
  carrier?: string | null;
  service?: string | null;
  estimatedDays?: number | null;
  freightCost?: number | null;
  pickupFee?: number | null;
  pickupPointId?: string | null;
  pickupPointName?: string | null;
  collectorId?: string | null;
  collectorName?: string | null;
  postedAt?: string | null;
  receivedAt?: string | null;
  receivedBy?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Pickup Request info
  pickupRequestId?: string | null;
  pickupRequestStatus?: string | null;
  pickupScheduledAt?: string | null;
  pickupCollectedAt?: string | null;
  pickupDeliveredToCarrierAt?: string | null;
  // Label info
  labelStatus?: string | null;
  labelFileUrl?: string | null;
  labelIsPrinted?: boolean;
  // Package info
  packageCount?: number;
  hasDivergence?: boolean;
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

export interface OpsKpis {
  /** Aguardando coleta/postagem (PICKUP_REQUESTED, AWAITING_DROP_OFF_AT_POINT, etc.) */
  backlog: number;
  /** Em coleta (COLLECTED_FROM_SENDER, IN_TRANSIT_TO_CARRIER_HUB) */
  inPickup: number;
  /** No ponto de coleta (DROPPED_OFF_AT_POINT, AWAITING_CARRIER_PICKUP_AT_POINT) */
  atPoC: number;
  /** Em trânsito (RECEIVED_AT_ORIGIN_HUB, IN_TRANSFER, IN_TRANSIT_TO_DESTINATION, etc.) */
  inTransit: number;
  /** Em rota de entrega (OUT_FOR_DELIVERY, AWAITING_PICKUP_AT_DESTINATION_HUB) */
  outForDelivery: number;
  /** Exceções/problemas (DELIVERY_ATTEMPT_FAILED, DELIVERY_PROBLEM, PICKUP_FAILED) */
  exceptions: number;
  /** Entregues (DELIVERED, DELIVERED_AT_DESTINATION_HUB) */
  delivered: number;
  /** Cancelados/devolvidos (todos da fase D) */
  cancelled: number;
}
