import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shipment, ShipmentStatus } from "@/shared/types/shipments";
import { apiFetch } from "@/platform/api/client";

type ShipmentFilters = {
  q?: string;
  status?: ShipmentStatus | "Todos";
  page?: number;
  limit?: number;
};

type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type ShipmentsResponse = {
  items: Shipment[];
  pagination: PaginationInfo;
};

const buildQueryString = (filters?: ShipmentFilters) => {
  const params = new URLSearchParams();
  const normalizedStatus = filters?.status;
  if (filters?.q) params.set("q", filters.q);
  if (normalizedStatus && normalizedStatus !== "Todos") {
    params.set("status", normalizedStatus);
  }
  if (filters?.page) params.set("page", filters.page.toString());
  if (filters?.limit) params.set("limit", filters.limit.toString());
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

export function useShipments(filters?: ShipmentFilters) {
  const queryKey = [
    "shipments",
    filters?.q ?? "",
    filters?.status ?? "Todos",
    filters?.page ?? 1,
    filters?.limit ?? 20,
  ] as const;
  const queryString = buildQueryString(filters);

  return useQuery<ShipmentsResponse>({
    queryKey,
    queryFn: () => apiFetch<ShipmentsResponse>(`/api/shipments${queryString}`),
  });
}

export function useCartClear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart", { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message || json?.mensagem || "Falha ao limpar carrinho");
      }
      return json?.data ?? json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useShipmentCancel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/shipments/${id}/cancel`, { method: "POST" });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message || json?.mensagem || "Falha ao cancelar envio");
      }
      return json?.data ?? json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
  });
}

/**
 * Hook para buscar envios não concluídos (abertos)
 * Usado para vincular tickets de suporte a envios em andamento
 *
 * Usa filtro server-side "Abertos" que exclui Entregue/Cancelado/Devolvido no banco.
 */
export function useOpenShipments() {
  return useQuery({
    queryKey: ["shipments", "open"],
    queryFn: () =>
      apiFetch<ShipmentsResponse>("/api/shipments?status=Abertos&limit=100"),
    select: (data) => ({
      items: (data.items ?? []).map((shipment: Shipment) => ({
        trackingCode: shipment.trackingCode,
        recipientCityUf: shipment.recipientCityUf,
        status: shipment.status,
      })),
      pagination: data.pagination,
    }),
  });
}
