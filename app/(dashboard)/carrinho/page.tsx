"use client";

import { useEffect, useMemo, useState } from "react";
import { Col, Flex, Row, Skeleton, Typography, message } from "antd";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { CartTable } from "@/components/cart/CartTable";
import { CartSummary } from "@/components/cart/CartSummary";
import { RemoveItemModal } from "@/components/cart/RemoveItemModal";
import { CheckoutCartModal } from "@/components/payments/CheckoutCartModal";
import {
  useCart,
  useCartClear as useCartClearMutation,
  useCartRemove,
  useCartUpdate,
} from "@/hooks/useCart";
import type { CartItem } from "@/types/cart";

type PendingUpdate = { id: string; quantidade: number };

export default function CarrinhoPage() {
  const cartQuery = useCart();

  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
    null,
  );
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [createdShipments, setCreatedShipments] = useState<{
    cartId: string;
    shipmentIds: string[];
    totalAmount: number;
  } | null>(null);

  const updateMutation = useCartUpdate(pendingUpdate?.id ?? "");
  const removeMutation = useCartRemove(pendingRemoveId ?? "");
  const clearMutation = useCartClearMutation();

  useEffect(() => {
    if (!pendingUpdate?.id) return;

    updateMutation.mutate(
      { quantidade: pendingUpdate.quantidade },
      {
        onSuccess: () => {
          message.success("Quantidade atualizada");
        },
        onError: (error) => {
          message.error(
            error instanceof Error
              ? error.message
              : "Falha ao atualizar quantidade",
          );
        },
        onSettled: () => {
          setPendingUpdate(null);
        },
      },
    );
  }, [pendingUpdate, updateMutation, message]);

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
  }, [pendingRemoveId, removeMutation, message]);

  const cart = cartQuery.data;
  const isLoading = cartQuery.isLoading;

  const hasItems = useMemo(
    () => (cart?.items?.length ?? 0) > 0,
    [cart?.items?.length],
  );

  const handleChangeQuantity = (itemId: string, quantidade: number) => {
    setPendingUpdate({ id: itemId, quantidade });
  };

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

  const handlePayCart = async () => {
    if (!cart?.items?.length) {
      message.error("Carrinho vazio.");
      return;
    }

    try {
      // Fazer checkout do carrinho (criar shipments)
      const response = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Checkout de todos os itens
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao processar checkout");
      }

      const result = await response.json();

      // Guardar informações dos shipments e abrir modal de pagamento
      setCreatedShipments({
        cartId: result.cartId,
        shipmentIds: result.shipmentIds,
        totalAmount: result.totalAmount,
      });
      setCheckoutModalOpen(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o pagamento.";
      message.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <Flex vertical gap={16}>
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Carrinho
        </Typography.Title>
        <Skeleton active />
      </Flex>
    );
  }

  if (!hasItems || !cart) {
    return <EmptyCart />;
  }

  return (
    <>
      <Flex vertical gap={16}>
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Carrinho
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Revise seus envios antes de finalizar a compra.
        </Typography.Paragraph>
      </Flex>

      <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <CartTable
            items={cart.items}
            onChangeQty={handleChangeQuantity}
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
      {createdShipments && createdShipments.shipmentIds.length > 0 && (
        <CheckoutCartModal
          open={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          cartId={createdShipments.cartId}
          shipmentIds={createdShipments.shipmentIds}
          totalAmount={createdShipments.totalAmount}
        />
      )}
    </>
  );
}
