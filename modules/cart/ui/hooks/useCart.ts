import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Cart,
  CartItem,
  CartItemSnapshot,
  CartUpdatableFields,
  CheckoutPayload,
  CheckoutResponse,
} from '@/shared/types/cart';

// Calcular peso cubado de um volume: (A × L × C) / 6000
function calculateCubicWeight(alturaCm: number, larguraCm: number, comprimentoCm: number): number {
  return (alturaCm * larguraCm * comprimentoCm) / 6000;
}

// Adapter: converte a nova estrutura do banco para a estrutura legada do frontend
function adaptCartSnapshot(snapshot: {
  id: string;
  status: string;
  totals: { subtotal?: number; desconto?: number; taxas?: number; total: number; moeda: string };
  items: CartItemSnapshot[];
}): Cart {
  // Converter items da nova estrutura para a estrutura legada
  const adaptedItems: CartItem[] = snapshot.items.map((item) => {
    // Calcular peso cubado para cada volume (se não existir)
    const volumesWithCubicWeight = item.volumes.map((v) => ({
      ...v,
      pesoCubadoKg: v.pesoCubadoKg ?? calculateCubicWeight(v.alturaCm, v.larguraCm, v.comprimentoCm),
    }));

    return {
      id: item.id,
      selectionId: "", // Não existe mais, usar string vazia
      quoteId: "", // Não existe mais, usar string vazia
      transportadora: item.selectedQuote.carrier,
      modalidade: item.selectedQuote.serviceName,
      prazoEstimadoDias: item.selectedQuote.deadlineDays,
      prazoDias: item.selectedQuote.deadlineDays,
      preco: item.selectedQuote.price,
      quantidade: 1, // Nova estrutura não tem quantidade
      origem: {
        cep: item.originAddress.cep,
        cidadeUF: `${item.originAddress.cidade}/${item.originAddress.uf}`,
      },
      destino: {
        cep: item.destination.cep,
        cidadeUF: `${item.destination.cidade}/${item.destination.uf}`,
      },
      destinatario: {
        nome: item.destination.nome,
        cidade: item.destination.cidade,
        uf: item.destination.uf,
      },
      devolucao: item.preferences.reverse || false,
      coleta: item.preferences.pickupRequested || false,
      volumes: volumesWithCubicWeight.map((v) => ({
        id: String(v.idx || 0),
        comprimentoCm: v.comprimentoCm,
        larguraCm: v.larguraCm,
        alturaCm: v.alturaCm,
        pesoKg: v.pesoKg,
      })),
      pesoTotalKg: item.volumes.reduce((sum, v) => sum + v.pesoKg, 0),
      pesoCubadoTotalKg: volumesWithCubicWeight.reduce((sum, v) => sum + v.pesoCubadoKg, 0),
      documento: "DECLARACAO", // Não temos essa info no snapshot
      aceitouDeclaracao: false,
      valorSeguro: item.insuranceValue,
      avisoRecebimento: false,
      status: "OK",
    };
  });

  // Retornar estrutura legada
  return {
    items: adaptedItems,
    subtotal: snapshot.totals.subtotal || snapshot.totals.total,
    descontos: snapshot.totals.desconto || 0,
    taxas: snapshot.totals.taxas || 0,
    total: snapshot.totals.total,
    currency: "BRL",
  };
}

export function useCart() {
  return useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const response = await fetch("/api/cart");
      if (!response.ok) {
        throw new Error("Falha ao carregar carrinho");
      }
      const json = await response.json();
      // Handle standardized API response { data: { cart: ... } }
      const data = json.data ?? json;
      return adaptCartSnapshot(data.cart);
    },
  });
}

export function useCartAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => {
      console.log("[CART_ADD] Payload enviado:", payload);
      const response = await fetch("/api/cart/items", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || "Falha ao adicionar ao carrinho";
        console.error("[CART_ADD] Erro da API:", errorData);
        throw new Error(errorMessage);
      }
      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return json.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCartUpdate(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: CartUpdatableFields) => {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao atualizar item do carrinho");
      }
      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return json.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCartRemove(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Falha ao remover item do carrinho");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCartClear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Falha ao limpar carrinho");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCartCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: CheckoutPayload,
    ): Promise<CheckoutResponse> => {
      const response = await fetch("/api/cart/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha no checkout");
      }
      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return (json.data ?? json) as CheckoutResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}
