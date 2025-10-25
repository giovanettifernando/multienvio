"use client";

import { useEffect, useMemo, useState } from "react";
import { Col, Flex, Row, Skeleton, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { CartTable } from "@/components/cart/CartTable";
import { CartSummary } from "@/components/cart/CartSummary";
import { RemoveItemModal } from "@/components/cart/RemoveItemModal";
import {
  useCart,
  useCartClear as useCartClearMutation,
  useCartRemove,
  useCartUpdate,
} from "@/hooks/useCart";
import {
  useCartClear as useShipmentsCartClear,
  useShipmentCreate,
} from "@/hooks/useShipments";
import type { CartItem } from "@/types/cart";

type PendingUpdate = { id: string; quantidade: number };

export default function CarrinhoPage() {
  const router = useRouter();
  const cartQuery = useCart();

  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
    null,
  );
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [isPayingCart, setIsPayingCart] = useState(false);

  const updateMutation = useCartUpdate(pendingUpdate?.id ?? "");
  const removeMutation = useCartRemove(pendingRemoveId ?? "");
  const clearMutation = useCartClearMutation();
  const createShipment = useShipmentCreate();
  const cartClear = useShipmentsCartClear();

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

  async function afterCartPaymentSuccess(paidItems: CartItem[]) {
    for (const item of paidItems) {
      await createShipment.mutateAsync({
        trackingCode:
          item.trackingCode ||
          `BR${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        recipientName: item.destinatario?.nome || "—",
        recipientCityUf:
          item.destinatario?.cidade && item.destinatario?.uf
            ? `${item.destinatario.cidade}/${item.destinatario.uf}`
            : item.destino?.cidadeUF ?? "—/--",
        carrierName: item.transportadora || item.modalidade || "—",
        etaDays: Number(item.prazoDias ?? item.prazoEstimadoDias ?? 0),
        expectedDeliveryDate: undefined,
        freightValue: Number(item.preco ?? 0),
        status: "Aguardando coleta",
        labelUrl: item.labelUrl,
        trackingUrl: item.trackingUrl,
      });
    }

    await cartClear.mutateAsync();

    message.success("Pagamento confirmado! Envios registrados com sucesso.");
    router.push("/shipments");
  }

  const handlePayCart = async (
    method: "WALLET" | "PIX" | "CARD" | "BOLETO",
  ) => {
    if (!cart?.items?.length) {
      message.error("Carrinho vazio.");
      return;
    }

    try {
      setIsPayingCart(true);
      const response = await fetch("/api/payments/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagamento: { metodo: method } }),
      });
      const result = await response.json();

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.mensagem || result?.message || "Falha no pagamento");
      }

      const itemsToRegister: CartItem[] = cart.items.map((item) => {
        const matchedLabel =
          result?.labels?.find?.(
            (label: { cartItemId?: string }) => label?.cartItemId === item.id,
          ) ?? null;

        return {
          ...item,
          trackingCode: matchedLabel?.trackingCode ?? item.trackingCode,
          labelUrl: matchedLabel?.labelUrl ?? item.labelUrl,
          trackingUrl: matchedLabel?.trackingUrl ?? item.trackingUrl,
        };
      });

      await afterCartPaymentSuccess(itemsToRegister);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro ao processar pagamento do carrinho.";
      message.error(errorMessage);
    } finally {
      setIsPayingCart(false);
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
            isCheckingOut={isPayingCart}
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
    </>
  );
}
