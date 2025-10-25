import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Cart,
  CartUpdatableFields,
  CheckoutPayload,
  CheckoutResponse,
} from "@/types/cart";

export function useCart() {
  return useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const response = await fetch("/api/carrinho");
      if (!response.ok) {
        throw new Error("Falha ao carregar carrinho");
      }
      return (await response.json()) as Cart;
    },
  });
}

export function useCartAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const response = await fetch("/api/carrinho", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao adicionar ao carrinho");
      }
      return response.json();
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
      const response = await fetch(`/api/carrinho/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao atualizar item do carrinho");
      }
      return response.json();
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
      const response = await fetch(`/api/carrinho/${itemId}`, {
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
      const response = await fetch("/api/carrinho", { method: "DELETE" });
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
      const response = await fetch("/api/carrinho/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha no checkout");
      }
      return response.json() as Promise<CheckoutResponse>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}
