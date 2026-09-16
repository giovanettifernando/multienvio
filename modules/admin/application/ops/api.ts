import type {
  OpsShipment,
  OpsException,
  OpsSLA,
  OpsEvent,
  OpsKpis,
  ListParams,
  Paged,
  TimelineEvent,
} from './types';

/**
 * Helper to extract data from standardized API response format { data: T, error, meta }
 */
async function extractData<T>(res: Response): Promise<T> {
  const json = await res.json();
  return (json.data ?? json) as T;
}

// Shipments
export async function listShipments(p: ListParams): Promise<Paged<OpsShipment>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.status) params.set('status', p.status);
  if (p.pickupType) params.set('pickupType', p.pickupType);
  if (p.carrier) params.set('carrier', p.carrier);
  if (p.pocId) params.set('pocId', p.pocId);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);
  if (p.riskOnly) params.set('riskOnly', 'true');

  const res = await fetch(`/api/admin/ops/shipments?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch shipments');
  return extractData<Paged<OpsShipment>>(res);
}

export async function bulkUpdateShipmentStatus(ids: string[], status: string): Promise<{ ok: true }> {
  const res = await fetch('/api/admin/ops/shipments/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids, status }),
  });
  if (!res.ok) throw new Error('Failed to update shipments');
  return extractData<{ ok: true }>(res);
}

export async function reprocessShipment(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/shipments/${id}/reprocess`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to reprocess shipment');
  return extractData<{ ok: true }>(res);
}

export async function getShipmentTimeline(id: string): Promise<TimelineEvent[]> {
  const res = await fetch(`/api/admin/ops/shipments/${id}/timeline`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return extractData<TimelineEvent[]>(res);
}

// Exceptions
export async function listExceptions(p: ListParams): Promise<Paged<OpsException>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.type) params.set('type', p.type);
  if (p.severity) params.set('severity', p.severity);
  if (p.status) params.set('status', p.status);
  if (p.carrier) params.set('carrier', p.carrier);
  if (p.pocId) params.set('pocId', p.pocId);

  const res = await fetch(`/api/admin/ops/exceptions?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch exceptions');
  return extractData<Paged<OpsException>>(res);
}

export async function updateException(id: string, patch: Partial<OpsException>): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/exceptions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update exception');
  return extractData<{ ok: true }>(res);
}

// SLA
export async function getSlaSummary(p: { dateStart?: string; dateEnd?: string }): Promise<OpsSLA[]> {
  const params = new URLSearchParams();
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/ops/sla?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch SLA');
  return extractData<OpsSLA[]>(res);
}

// Events/Webhooks
export async function listEvents(p: ListParams): Promise<Paged<OpsEvent>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.processed !== undefined) params.set('processed', p.processed.toString());
  if (p.source) params.set('source', p.source);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/ops/events?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch events');
  return extractData<Paged<OpsEvent>>(res);
}

export async function retryEvent(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/events/${id}/retry`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to retry event');
  return extractData<{ ok: true }>(res);
}

export async function markEventProcessed(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/events/${id}/mark`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark event');
  return extractData<{ ok: true }>(res);
}

// KPIs
export async function getOpsKpis(): Promise<OpsKpis> {
  const res = await fetch('/api/admin/ops/kpis', {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return extractData<OpsKpis>(res);
}
