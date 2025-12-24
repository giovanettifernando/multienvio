export type PickupStatus = 'PENDING' | 'SCHEDULED' | 'FAILED' | 'CANCELED' | 'COMPLETED';

export interface PickupRequest {
  id: string;
  userId: string;
  collectorId?: string | null;
  shipmentId: string;
  originCep: string;
  originAddress?: string | null;
  originCity?: string | null;
  originUf?: string | null;
  windowStart?: string | null; // ISO date string
  windowEnd?: string | null; // ISO date string
  status: PickupStatus;
  notes?: string | null;
  scheduleAt?: string | null; // ISO date string - data/hora agendada pelo coletor
  attemptCount: number; // Número de tentativas de coleta
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface PickupRequestWithShipment extends PickupRequest {
  shipment: {
    id: string;
    trackingCode?: string | null;
    platformTrackingCode?: string | null;
    carrier?: string | null;
    service?: string | null;
    originCep?: string | null;
    destinationCep?: string | null;
    recipientName?: string | null;
  };
  collector?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Estrutura de uma tentativa de coleta armazenada no campo attemptNotes
 */
export interface PickupAttemptNote {
  date: string; // ISO date string
  note: string;
  operator?: string;
  success?: boolean;
}

/**
 * Dados completos de uma coleta para a página de detalhes
 */
export interface PickupRequestDetail extends Omit<PickupRequest, 'attemptCount'> {
  attemptCount: number;
  attemptNotes: PickupAttemptNote[];
  collectedAt?: string | null;
  collectedBy?: string | null;
  shipment: {
    id: string;
    platformTrackingCode?: string | null;
    carrier?: string | null;
    service?: string | null;
    originCep?: string | null;
    destinationCep?: string | null;
    recipientName?: string | null;
  };
  collector?: {
    id: string;
    name: string;
  } | null;
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
