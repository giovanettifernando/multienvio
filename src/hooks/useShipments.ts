import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shipment, ShipmentStatus } from "@/src/types/shipments";
import { afterShipmentCreated } from "@/lib/shipments/after-create";

type ShipmentFilters = {
  q?: string;
  status?: ShipmentStatus | "Todos";
};

const buildQueryString = (filters?: ShipmentFilters) => {
  const params = new URLSearchParams();
  const normalizedStatus = filters?.status;
  if (filters?.q) params.set("q", filters.q);
  if (normalizedStatus && normalizedStatus !== "Todos") {
    params.set("status", normalizedStatus);
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

export function useShipments(filters?: ShipmentFilters) {
  const queryKey = ["shipments", filters?.q ?? "", filters?.status ?? "Todos"] as const;
  const queryString = buildQueryString(filters);

  return useQuery<{ items: Shipment[] }>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/shipments${queryString}`);
      if (!response.ok) {
        throw new Error("Falha ao carregar envios");
      }
      return response.json();
    },
  });
}

export function useShipmentCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Shipment>) => {
      const response = await fetch("/api/shipments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.mensagem || "Falha ao registrar envio");
      }
      return data;
    },
    onSuccess: (shipment: Shipment) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      // Cria etiqueta local automaticamente
      afterShipmentCreated(queryClient, shipment);
    },
  });
}

export function useCartClear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.mensagem || "Falha ao limpar carrinho");
      }
      return data;
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
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.mensagem || "Falha ao cancelar envio");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
  });
}

/**
 * Hook para buscar envios não concluídos (abertos)
 * Usado para vincular tickets de suporte a envios em andamento
 */
export function useOpenShipments() {
  return useQuery({
    queryKey: ["shipments", "open"],
    queryFn: async () => {
      const response = await fetch("/api/shipments");
      if (!response.ok) {
        throw new Error("Falha ao carregar envios");
      }
      const data = await response.json();

      // Filtrar apenas envios não concluídos/entregues/cancelados
      const openItems = data.items?.filter(
        (shipment: Shipment) =>
          shipment.status !== "Entregue" &&
          shipment.status !== "Cancelado"
      ) ?? [];

      return { items: openItems };
    },
    select: (data) => ({
      items: data.items.map((shipment: Shipment) => ({
        trackingCode: shipment.trackingCode,
        recipientCityUf: shipment.recipientCityUf,
        status: shipment.status,
      })),
    }),
  });
}
