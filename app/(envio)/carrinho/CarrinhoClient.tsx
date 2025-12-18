"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { App } from "antd";
import { ELGrid } from '@/shared/ui/ELGrid';
import { ELSkeleton } from '@/shared/ui/ELSkeleton';
import { EmptyCart } from '@/modules/cart/ui/components/EmptyCart';
import { CartTable } from '@/modules/cart/ui/components/CartTable';
import { CartSummary } from '@/modules/cart/ui/components/CartSummary';
import { RemoveItemModal } from '@/modules/cart/ui/components/RemoveItemModal';
import { CheckoutCartModal } from '@/modules/payments/ui/components/CheckoutCartModal';
import {
  useCart,
  useCartClear as useCartClearMutation,
} from "@/hooks/useCart";
import type { CartItem } from '@/shared/types/cart';
import { PageShell } from '@/shared/ui/PageShell';
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function CarrinhoClient() {
  const { message } = App.useApp();
  const cartQuery = useCart();
  const queryClient = useQueryClient();

  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // Usar ref para evitar múltiplas chamadas simultâneas
  const isRemovingRef = useRef(false);

  const removeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Falha ao remover item do carrinho");
      }
      return response.json();
    },
    onSuccess: () => {
      message.success("Item removido do carrinho");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error) => {
      message.error(
        error instanceof Error
          ? error.message
          : "Falha ao remover item do carrinho",
      );
    },
    onSettled: () => {
      isRemovingRef.current = false;
    },
  });

  const clearMutation = useCartClearMutation();

  const cart = cartQuery.data;
  const isLoading = cartQuery.isLoading;

  const hasItems = useMemo(
    () => (cart?.items?.length ?? 0) > 0,
    [cart?.items?.length],
  );

  const handleRemove = (item: CartItem) => {
    setItemToRemove(item);
    setRemoveModalOpen(true);
  };

  const confirmRemove = useCallback(() => {
    if (!itemToRemove) return;
    if (isRemovingRef.current) return; // Evitar múltiplas chamadas

    isRemovingRef.current = true;
    setRemoveModalOpen(false);
    removeMutation.mutate(itemToRemove.id);
  }, [itemToRemove, removeMutation]);

  const handleClearCart = () => {
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        message.success("Carrinho limpo");
      },
      onError: (error) => {
        message.error(
          error instanceof Error
            ? error.message
            : "Falha ao limpar carrinho",
        );
      },
    });
  };

  const handlePayCart = () => {
    if (!cart?.items?.length) {
      message.error("Carrinho vazio.");
      return;
    }

    // Simplesmente abrir modal de pagamento
    // Shipments serão criados APÓS pagamento ser confirmado
    setCheckoutModalOpen(true);
  };

  if (isLoading) {
    return (
      <PageShell title="Carrinho" gap="md">
        <ELSkeleton />
      </PageShell>
    );
  }

  if (!hasItems || !cart) {
    return <EmptyCart />;
  }

  return (
    <>
      <PageShell title="Carrinho" gap="md">
        <ELGrid variant="cart" gap="xl">
          <CartTable
            items={cart.items}
            onRemove={handleRemove}
          />
          <CartSummary
            cart={cart}
            isClearing={clearMutation.isPending}
            onClear={handleClearCart}
            onCheckout={handlePayCart}
          />
        </ELGrid>

        <RemoveItemModal
        open={removeModalOpen}
        item={itemToRemove}
        confirmLoading={removeMutation.isPending}
        onCancel={() => setRemoveModalOpen(false)}
        onConfirm={confirmRemove}
        />

        {/* Modal de escolha de pagamento */}
        {cart && (
          <CheckoutCartModal
            open={checkoutModalOpen}
            onClose={() => setCheckoutModalOpen(false)}
            cart={cart}
          />
        )}
      </PageShell>
    </>
  );
}
