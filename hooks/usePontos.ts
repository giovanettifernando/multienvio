import { useMemo } from 'react';
import { usePontosStore } from '@/stores/pontos';
import type { StatusOperacional } from '@/lib/pickup/types';

export function usePontos(filter?: {
  status?: StatusOperacional | 'all';
  uf?: string;
  cidade?: string;
  query?: string;
}) {
  const points = usePontosStore((s) => s.points);

  return useMemo(() => {
    let filtered = [...points];

    // Filtrar por status
    if (filter?.status && filter.status !== 'all') {
      filtered = filtered.filter((p) => p.status === filter.status);
    }

    // Filtrar por UF
    if (filter?.uf) {
      filtered = filtered.filter((p) => p.uf?.toUpperCase() === filter.uf!.toUpperCase());
    }

    // Filtrar por cidade
    if (filter?.cidade) {
      filtered = filtered.filter((p) =>
        p.cidade?.toLowerCase().includes(filter.cidade!.toLowerCase())
      );
    }

    // Busca por texto
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.razaoSocial.toLowerCase().includes(q) ||
          p.nomeFantasia?.toLowerCase().includes(q) ||
          p.cnpj.includes(q) ||
          p.cidade?.toLowerCase().includes(q) ||
          p.uf?.toLowerCase().includes(q)
      );
    }

    // Ordenar por updatedAt desc
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [points, filter]);
}

export function usePonto(id: string | null) {
  const point = usePontosStore((s) => (id ? s.points.find((p) => p.id === id) : undefined));
  const updatePoint = usePontosStore((s) => s.updatePoint);
  const deletePoint = usePontosStore((s) => s.deletePoint);
  const toggleStatus = usePontosStore((s) => s.toggleStatus);

  return { point, updatePoint, deletePoint, toggleStatus };
}

export function useActivePontos() {
  return usePontosStore((s) => s.getActivePoints());
}

export function usePontosByLocation(uf?: string, cidade?: string) {
  const getByLocation = usePontosStore((s) => s.getPointsByLocation);

  return useMemo(() => {
    return getByLocation(uf, cidade);
  }, [getByLocation, uf, cidade]);
}

export function useDefaultPonto() {
  const defaultId = usePontosStore((s) => s.defaultPointId);
  const setDefault = usePontosStore((s) => s.setDefaultPoint);
  const point = usePontosStore((s) =>
    defaultId ? s.points.find((p) => p.id === defaultId) : undefined
  );

  return { defaultId, defaultPoint: point, setDefault };
}

export function usePontosActions() {
  const createPoint = usePontosStore((s) => s.createPoint);
  const updatePoint = usePontosStore((s) => s.updatePoint);
  const deletePoint = usePontosStore((s) => s.deletePoint);
  const toggleStatus = usePontosStore((s) => s.toggleStatus);
  const setDefaultPoint = usePontosStore((s) => s.setDefaultPoint);

  return {
    createPoint,
    updatePoint,
    deletePoint,
    toggleStatus,
    setDefaultPoint,
  };
}
