import { useMemo } from "react";
import { useColetasStore } from "@/stores/coletas";
import type { ColetaStatus } from "@/lib/coletas/types";
import { normalizeString } from "@/lib/utils/string";

interface UseColetasFilters {
  status?: ColetaStatus | "all";
  q?: string; // Busca por shipmentId, cidade, UF, bairro, transportadora
  cidade?: string; // Filtro específico por cidade
  uf?: string; // Filtro específico por UF
  shipmentId?: string; // Filtro específico por shipmentId
  page?: number; // Página atual (1-indexed)
  pageSize?: number; // Itens por página
}

/**
 * Hook para listar coletas com filtros e paginação
 */
export function useColetas(filters?: UseColetasFilters) {
  const coletas = useColetasStore((s) => s.coletas);

  return useMemo(() => {
    let filtered = [...coletas];

    // Filtro de status
    if (filters?.status && filters.status !== "all") {
      filtered = filtered.filter((c) => c.status === filters.status);
    }

    // Filtro específico por shipmentId
    if (filters?.shipmentId?.trim()) {
      const shipmentId = filters.shipmentId.trim();
      filtered = filtered.filter((c) =>
        normalizeString(c.shipmentId).includes(normalizeString(shipmentId))
      );
    }

    // Filtro específico por cidade
    if (filters?.cidade?.trim()) {
      const cidade = filters.cidade.trim();
      filtered = filtered.filter((c) =>
        normalizeString(c.origem.cidade).includes(normalizeString(cidade))
      );
    }

    // Filtro específico por UF
    if (filters?.uf?.trim()) {
      const uf = filters.uf.trim().toUpperCase();
      filtered = filtered.filter((c) => c.origem.uf === uf);
    }

    // Filtro de busca textual geral
    if (filters?.q?.trim()) {
      const query = filters.q.trim();
      filtered = filtered.filter((c) => {
        const searchableText = [
          c.shipmentId,
          c.origem.cidade,
          c.origem.uf,
          c.origem.logradouro,
          c.origem.bairro,
          c.transportadora,
        ]
          .filter(Boolean)
          .join(" ");

        return normalizeString(searchableText).includes(normalizeString(query));
      });
    }

    // Ordenar por updatedAt desc (mais recente primeiro)
    filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    // Aplicar paginação se especificada
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? filtered.length; // Sem paginação por padrão
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const paginated = filtered.slice(startIndex, endIndex);

    return {
      items: paginated,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize),
    };
  }, [
    coletas,
    filters?.status,
    filters?.q,
    filters?.cidade,
    filters?.uf,
    filters?.shipmentId,
    filters?.page,
    filters?.pageSize,
  ]);
}

/**
 * Hook para buscar coleta por ID
 */
export function useColeta(id: string | null) {
  const coletas = useColetasStore((s) => s.coletas);

  return useMemo(() => {
    if (!id) return null;
    return coletas.find((c) => c.id === id) ?? null;
  }, [coletas, id]);
}

/**
 * Hook para buscar coleta por shipmentId
 */
export function useColetaByShipment(shipmentId: string | null) {
  const findByShipmentId = useColetasStore((s) => s.findByShipmentId);

  return useMemo(() => {
    if (!shipmentId) return null;
    return findByShipmentId(shipmentId) ?? null;
  }, [shipmentId, findByShipmentId]);
}

/**
 * Hook para actions do store
 */
export function useColetasActions() {
  const create = useColetasStore((s) => s.create);
  const update = useColetasStore((s) => s.update);
  const updateStatus = useColetasStore((s) => s.updateStatus);
  const remove = useColetasStore((s) => s.remove);

  return {
    create,
    update,
    updateStatus,
    remove,
  };
}
