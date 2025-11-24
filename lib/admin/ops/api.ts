import type {
  OpsShipment,
  PickupOrder,
  PointOfCollection,
  OpsException,
  OpsSLA,
  OpsEvent,
  ListParams,
  Paged,
  TimelineEvent,
} from './types';

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
  return res.json();
}

export async function bulkUpdateShipmentStatus(ids: string[], status: string): Promise<{ ok: true }> {
  const res = await fetch('/api/admin/ops/shipments/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids, status }),
  });
  if (!res.ok) throw new Error('Failed to update shipments');
  return res.json();
}

export async function reprocessShipment(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/shipments/${id}/reprocess`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to reprocess shipment');
  return res.json();
}

export async function getShipmentTimeline(id: string): Promise<TimelineEvent[]> {
  const res = await fetch(`/api/admin/ops/shipments/${id}/timeline`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}

// Pickups
export async function listPickups(p: ListParams): Promise<Paged<PickupOrder>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.type) params.set('type', p.type);
  if (p.provider) params.set('provider', p.provider);
  if (p.status) params.set('status', p.status);
  if (p.city) params.set('city', p.city);
  if (p.state) params.set('state', p.state);

  const res = await fetch(`/api/admin/ops/pickups?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch pickups');
  return res.json();
}

export async function updatePickup(id: string, patch: Partial<PickupOrder>): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/pickups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update pickup');
  return res.json();
}

// Points of Collection
export async function listPoC(p: ListParams): Promise<PointOfCollection[]> {
  const params = new URLSearchParams();
  if (p.q) params.set('q', p.q);
  if (p.city) params.set('city', p.city);
  if (p.state) params.set('state', p.state);
  if (p.active !== undefined) params.set('active', p.active.toString());

  const res = await fetch(`/api/admin/ops/pocs?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch PoCs');
  return res.json();
}

export async function togglePoCActive(id: string, active: boolean): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/pocs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ active }),
  });
  if (!res.ok) throw new Error('Failed to toggle PoC');
  return res.json();
}

export async function updatePoC(id: string, patch: Partial<PointOfCollection>): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/pocs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update PoC');
  return res.json();
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
  return res.json();
}

export async function updateException(id: string, patch: Partial<OpsException>): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/exceptions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update exception');
  return res.json();
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
  return res.json();
}

// Events/Webhooks
export async function listEvents(p: ListParams): Promise<Paged<OpsEvent>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.processed !== undefined) params.set('processed', p.processed.toString());
  if (p.source) params.set('source', p.source);

  const res = await fetch(`/api/admin/ops/events?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function retryEvent(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/events/${id}/retry`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to retry event');
  return res.json();
}

export async function markEventProcessed(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/ops/events/${id}/mark`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark event');
  return res.json();
}
