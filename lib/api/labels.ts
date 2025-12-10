import { LabelsQuery, LabelsResponse } from '@/lib/types/label';

export async function fetchLabels(params: LabelsQuery = {}): Promise<LabelsResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.q) sp.set('q', params.q);
  if (params.printStatus) sp.set('printStatus', params.printStatus);

  const res = await fetch(`/api/labels?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao carregar etiquetas');
  const json = await res.json();
  // Handle standardized API response format { data: T, error, meta }
  return (json.data ?? json) as LabelsResponse;
}
