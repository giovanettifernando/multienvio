import type {
  PeriodFilter,
  FinanceSummary,
  LedgerEntry,
  Invoice,
  CarrierPayout,
  CarrierPayoutsResponse,
  CommissionItem,
  ChargebackItem,
  Paged,
  ListParams,
  ProfileType,
  CommissionStatusFilter,
  ProfileCommissionsResponse,
} from './types';

// GET summary
export async function getFinanceSummary(p: PeriodFilter): Promise<FinanceSummary> {
  const params = new URLSearchParams();
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/summary?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch finance summary');
  return res.json();
}

// Ledgers
export async function listLedger(p: ListParams): Promise<Paged<LedgerEntry>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.customerId) params.set('customerId', p.customerId);
  if (p.carrier) params.set('carrier', p.carrier);
  if (p.method) params.set('method', p.method);
  if (p.kind) params.set('kind', p.kind);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);
  if (p.reconciled !== undefined) params.set('reconciled', p.reconciled.toString());

  const res = await fetch(`/api/admin/finance/ledger?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch ledger');
  return res.json();
}

export async function reconcileLedger(ids: string[]): Promise<{ ok: true }> {
  const res = await fetch('/api/admin/finance/ledger/reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to reconcile ledger');
  return res.json();
}

export async function createAdjustment(entry: Partial<LedgerEntry>): Promise<{ ok: true; id: string }> {
  const res = await fetch('/api/admin/finance/ledger/adjustment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to create adjustment');
  return res.json();
}

// Invoices
export async function listInvoices(p: ListParams): Promise<Paged<Invoice>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.status) params.set('status', p.status);
  if (p.customerId) params.set('customerId', p.customerId);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/invoices?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

export async function markInvoicePaid(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/invoices/${id}/paid`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark invoice as paid');
  return res.json();
}

export async function cancelInvoice(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/invoices/${id}/cancel`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to cancel invoice');
  return res.json();
}

// Reconciliation
export async function listUnreconciled(p: ListParams): Promise<Paged<LedgerEntry>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/reconciliation?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch unreconciled entries');
  return res.json();
}

export async function markReconciled(ids: string[]): Promise<{ ok: true }> {
  const res = await fetch('/api/admin/finance/reconciliation/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to mark as reconciled');
  return res.json();
}

// Chargebacks
export async function listChargebacks(p: ListParams): Promise<Paged<ChargebackItem>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.status) params.set('status', p.status);
  if (p.method) params.set('method', p.method);
  if (p.customerId) params.set('customerId', p.customerId);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/chargebacks?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch chargebacks');
  return res.json();
}

export async function updateChargeback(id: string, status: 'approved' | 'denied'): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/chargebacks/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update chargeback');
  return res.json();
}

// Carrier payouts
export async function listPayouts(p: ListParams): Promise<Paged<CarrierPayout>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.carrier) params.set('carrier', p.carrier);
  if (p.status) params.set('status', p.status);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/payouts?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch payouts');
  return res.json();
}

export async function markPayoutPaid(id: string, reference?: string, proofUrl?: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/payouts/${id}/paid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reference, proofUrl }),
  });
  if (!res.ok) throw new Error('Failed to mark payout as paid');
  return res.json();
}

// Carrier payouts calculation (for reconciliation)
export async function getCarrierPayouts(p: PeriodFilter & { carrier?: string }): Promise<CarrierPayoutsResponse> {
  const params = new URLSearchParams();
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);
  if (p.carrier) params.set('carrier', p.carrier);

  const res = await fetch(`/api/admin/finance/carrier-payouts?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch carrier payouts');
  return res.json();
}

// Profile commissions (collectors and pickup points)
export async function getProfileCommissions(
  p: PeriodFilter & { profileType: ProfileType; status?: CommissionStatusFilter }
): Promise<ProfileCommissionsResponse> {
  const params = new URLSearchParams();
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);
  params.set('profileType', p.profileType);
  if (p.status) params.set('status', p.status);

  const res = await fetch(`/api/admin/finance/profile-commissions?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch profile commissions');
  return res.json();
}

// Commissions
export async function listCommissions(p: ListParams): Promise<Paged<CommissionItem>> {
  const params = new URLSearchParams();
  if (p.page) params.set('page', p.page.toString());
  if (p.pageSize) params.set('pageSize', p.pageSize.toString());
  if (p.q) params.set('q', p.q);
  if (p.status) params.set('status', p.status);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/commissions?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch commissions');
  return res.json();
}

export async function approveCommission(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/commissions/${id}/approve`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to approve commission');
  return res.json();
}

export async function markCommissionPaid(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/commissions/${id}/paid`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark commission as paid');
  return res.json();
}

// Reports
export async function downloadReportCSV(p: PeriodFilter & { report: 'dre' | 'taxes' | 'fees' }): Promise<Blob> {
  const params = new URLSearchParams();
  params.set('report', p.report);
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/reports?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to download report');
  return res.blob();
}
