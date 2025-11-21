"use client";

import { useEffect, useMemo, useState } from "react";
import { Col, Row, Skeleton, message } from "antd";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { CartTable } from "@/components/cart/CartTable";
import { CartSummary } from "@/components/cart/CartSummary";
import { RemoveItemModal } from "@/components/cart/RemoveItemModal";
import { CheckoutCartModal } from "@/components/payments/CheckoutCartModal";
import {
  useCart,
  useCartClear as useCartClearMutation,
  useCartRemove,
} from "@/hooks/useCart";
import type { CartItem } from "@/types/cart";
import { PageShell } from "@/components/shared/PageShell";

export default function CarrinhoPage() {
  const cartQuery = useCart();

  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  const removeMutation = useCartRemove(pendingRemoveId ?? "");
  const clearMutation = useCartClearMutation();

  useEffect(() => {
    if (!pendingRemoveId) return;

    removeMutation.mutate(undefined, {
      onSuccess: () => {
        message.success("Item removido do carrinho");
      },
      onError: (error) => {
        message.error(
          error instanceof Error
            ? error.message
            : "Falha ao remover item do carrinho",
        );
      },
      onSettled: () => {
        setPendingRemoveId(null);
      },
    });
  }, [pendingRemoveId, removeMutation]);

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

  const confirmRemove = () => {
    if (!itemToRemove) return;
    setRemoveModalOpen(false);
    setPendingRemoveId(itemToRemove.id);
  };

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
        <Skeleton active />
      </PageShell>
    );
  }

  if (!hasItems || !cart) {
    return <EmptyCart />;
  }

  return (
    <>
      <PageShell title="Carrinho" gap="md">
        <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <CartTable
            items={cart.items}
            onRemove={handleRemove}
          />
        </Col>
        <Col xs={24} lg={8}>
          <CartSummary
            cart={cart}
            isClearing={clearMutation.isPending}
            onClear={handleClearCart}
            onCheckout={handlePayCart}
          />
        </Col>
        </Row>

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
