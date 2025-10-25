import { LabelsQuery, LabelsResponse } from '@/lib/types/label';
import { loadLocalLabels, uniqueById } from '@/lib/labels/cache';

export async function fetchLabels(params: LabelsQuery = {}): Promise<LabelsResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.q) sp.set('q', params.q);
  if (params.status && params.status !== 'all') sp.set('status', params.status);
  if (params.carrier && params.carrier !== 'all') sp.set('carrier', params.carrier);
  if (params.dateStart) sp.set('dateStart', params.dateStart);
  if (params.dateEnd) sp.set('dateEnd', params.dateEnd);

  const res = await fetch(`/api/labels?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao carregar etiquetas');
  const remote = (await res.json()) as LabelsResponse;

  // Mesclar com etiquetas locais (criadas no front-end)
  const local = loadLocalLabels();
  const merged = uniqueById([...local, ...(remote.items ?? [])]);

  return {
    ...remote,
    items: merged,
    total: merged.length
  };
}
