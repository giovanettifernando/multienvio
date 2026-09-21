import type { PeriodFilter, FinanceSummary, CarrierPayoutsResponse } from './types';

/**
 * Helper to extract data from standardized API response format { data: T, error, meta }
 */
async function extractData<T>(res: Response): Promise<T> {
  const json = await res.json();
  return (json.data ?? json) as T;
}

// GET summary
export async function getFinanceSummary(p: PeriodFilter): Promise<FinanceSummary> {
  const params = new URLSearchParams();
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);

  const res = await fetch(`/api/admin/finance/summary?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch finance summary');
  return extractData<FinanceSummary>(res);
}

// Ledgers
export async function getCarrierPayouts(p: PeriodFilter & { carrier?: string }): Promise<CarrierPayoutsResponse> {
  const params = new URLSearchParams();
  if (p.dateStart) params.set('dateStart', p.dateStart);
  if (p.dateEnd) params.set('dateEnd', p.dateEnd);
  if (p.carrier) params.set('carrier', p.carrier);

  const res = await fetch(`/api/admin/finance/carrier-payouts?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch carrier payouts');
  return extractData<CarrierPayoutsResponse>(res);
}

// Profile commissions (collectors and pickup points)
