export type PickupStatus = 'PENDING' | 'SCHEDULED' | 'FAILED' | 'CANCELED' | 'COMPLETED';

export interface PickupRequest {
  id: string;
  companyId?: string | null;
  userId: string;
  shipmentId: string;
  originCep: string;
  originAddress?: string | null;
  originCity?: string | null;
  originUf?: string | null;
  windowStart?: string | null; // ISO date string
  windowEnd?: string | null; // ISO date string
  status: PickupStatus;
  notes?: string | null;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface PickupRequestWithShipment extends PickupRequest {
  shipment: {
    id: string;
    trackingCode: string;
    carrier?: string | null;
    service?: string | null;
  };
}

export interface PickupRequestsQuery {
  page?: number;
  pageSize?: number;
  status?: PickupStatus | 'all';
  dateStart?: string; // ISO date string
  dateEnd?: string; // ISO date string
  city?: string;
  q?: string; // Busca por tracking code ou CEP
}

export interface PickupRequestsResponse {
  items: PickupRequestWithShipment[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreatePickupRequestData {
  shipmentId: string;
  windowStart?: string; // ISO date string
  windowEnd?: string; // ISO date string
  notes?: string;
}

export interface UpdatePickupRequestData {
  status?: PickupStatus;
  windowStart?: string; // ISO date string
  windowEnd?: string; // ISO date string
  notes?: string;
}
