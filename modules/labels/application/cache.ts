import type { LabelItem, LabelsResponse } from '@/shared/types/label';
import type { QueryClient } from '@tanstack/react-query';

const LS_KEY = 'labels.local';

export function loadLocalLabels(): LabelItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]') as LabelItem[];
  } catch {
    return [];
  }
}

export function saveLocalLabels(items: LabelItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export function pushLocalLabel(newItem: LabelItem) {
  const cur = loadLocalLabels();
  const idx = cur.findIndex(x => x.id === newItem.id);
  if (idx >= 0) cur[idx] = newItem;
  else cur.unshift(newItem);
  saveLocalLabels(cur);
}

export function uniqueById(items: LabelItem[]): LabelItem[] {
  const seen = new Set<string>();
  const out: LabelItem[] = [];
  for (const it of items) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      out.push(it);
    }
  }
  return out;
}

/** Atualiza imediatamente a tabela de /etiquetas (React Query key: ['labels']) */
export function pushLabelToQueryCache(qc: QueryClient, item: LabelItem) {
  pushLocalLabel(item);

  // Atualiza todas as queries com a key ['labels']
  qc.setQueriesData({ queryKey: ['labels'] }, (old: LabelsResponse | undefined) => {
    if (!old) return old;
    const merged = uniqueById([item, ...(old.items ?? [])]);
    return { ...old, items: merged, total: merged.length };
  });
}
