import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shipment, ShipmentStatus } from "@/types/shipments";
import { afterShipmentCreated } from "@/lib/shipments/after-create";

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
    queryFn: async () => {
      const response = await fetch(`/api/shipments${queryString}`);
      if (!response.ok) {
        throw new Error("Falha ao carregar envios");
      }
      return response.json();
    },
  });
}

/**
 * @deprecated ⚠️ HOOK OBSOLETO - NÃO USAR ⚠️
 *
 * O endpoint POST /api/shipments foi REMOVIDO e migrado para:
 * - /api/checkout (para criar shipment individual a partir de cotação)
 * - /api/cart/checkout (para criar múltiplos shipments do carrinho)
 *
 * Este hook só existe para compatibilidade e sempre retornará erro.
 *
 * Se você precisa criar shipments, use os fluxos de checkout apropriados:
 * - Para cotação única: navegar para /cotacoes/finalizar e usar executeCheckout
 * - Para carrinho: usar useCartCheckout hook
 *
 * @see /api/checkout - Endpoint de checkout individual
 * @see /api/cart/checkout - Endpoint de checkout em lote
 */
export function useShipmentCreate() {
  const queryClient = useQueryClient();
  return useMutation({
     
    mutationFn: async (_payload: Partial<Shipment>) => {
      console.error(
        '❌ ERRO: useShipmentCreate está obsoleto! POST /api/shipments foi removido.\n' +
        'Use os fluxos de checkout apropriados:\n' +
        '  - Checkout individual: /api/checkout\n' +
        '  - Checkout de carrinho: /api/cart/checkout'
      );
      throw new Error(
        'useShipmentCreate está obsoleto. O endpoint POST /api/shipments foi removido. ' +
        'Use /api/checkout ou /api/cart/checkout para criar shipments.'
      );
    },
    onSuccess: (shipment: Shipment) => {
      // Este código nunca será executado devido ao erro acima
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
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
 *
 * NOTA: Solicita até 100 envios abertos. Se o usuário tiver mais de 100 envios
 * em andamento, pode ser necessário implementar paginação ou busca.
 */
export function useOpenShipments() {
  return useQuery({
    queryKey: ["shipments", "open"],
    queryFn: async () => {
      // Solicitar até 100 registros para cobrir a maioria dos casos
      const response = await fetch("/api/shipments?limit=100");
      if (!response.ok) {
        throw new Error("Falha ao carregar envios");
      }
      const data: ShipmentsResponse = await response.json();

      // Filtrar apenas envios não concluídos/entregues/cancelados
      const openItems = data.items?.filter(
        (shipment: Shipment) =>
          shipment.status !== "Entregue" &&
          shipment.status !== "Cancelado"
      ) ?? [];

      return { items: openItems, pagination: data.pagination };
    },
    select: (data) => ({
      items: data.items.map((shipment: Shipment) => ({
        trackingCode: shipment.trackingCode,
        recipientCityUf: shipment.recipientCityUf,
        status: shipment.status,
      })),
      pagination: data.pagination,
    }),
  });
}
