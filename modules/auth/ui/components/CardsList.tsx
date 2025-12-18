"use client";

import React, { useState } from "react";
import {
  App,
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from "antd";
import { CreditCardOutlined, DeleteOutlined, StarOutlined, StarFilled } from "@ant-design/icons";
import type { Card as CardType } from '@/shared/types/account';
import {
  useCards,
  useCardCreate,
  useCardDelete,
  useCardUpdate,
} from "@/modules/account/ui/hooks";
import { CardModal, type CardFormValues } from "@/modules/auth/ui/components/CardModal";

export default function CardsList() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const cardsQuery = useCards();
  const createMutation = useCardCreate();
  const [showModal, setShowModal] = useState(false);
  const deleteMutation = useCardDelete();
  const defaultMutation = useCardUpdate();

  const cards = cardsQuery.data ?? [];

  const handleSubmit = (values: CardFormValues) => {
    // CardModal retorna dados completos do cartão + token MP
    createMutation.mutate(values, {
      onSuccess: () => {
        message.success("Cartão adicionado e vinculado ao Mercado Pago.");
        setShowModal(false);
      },
      onError: (error) => {
        message.error(
          error instanceof Error
            ? error.message
            : "Falha ao adicionar cartão.",
        );
      },
    });
  };

  const handleDelete = (cardId: string) => {
    deleteMutation.mutate(cardId, {
      onSuccess: () => {
        message.success("Cartão removido.");
      },
      onError: (error) => {
        message.error(
          error instanceof Error
            ? error.message
            : "Falha ao remover cartão.",
        );
      },
    });
  };

  const handleSetDefault = (cardId: string) => {
    defaultMutation.mutate(
      { id: cardId, payload: { isDefault: true } },
      {
        onSuccess: () => {
          message.success("Cartão definido como principal.");
        },
        onError: (error) => {
          message.error(
            error instanceof Error
              ? error.message
              : "Falha ao atualizar cartão.",
          );
        },
      },
    );
  };

  const loading = cardsQuery.isLoading;

  return (
    <Card
      title="Cartões de pagamento"
      extra={
        <Button type="primary" icon={<CreditCardOutlined />} onClick={() => setShowModal(true)}>
          Adicionar cartão
        </Button>
      }
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin />
        </div>
      ) : cards.length === 0 ? (
        <Empty description="Nenhum cartão cadastrado." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: token.marginXS }}>
          {cards.map((item: CardType) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: `${token.paddingSM}px 0`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space style={{ marginBottom: token.marginXS }}>
                  <Typography.Text strong>{item.holderName}</Typography.Text>
                  {item.isDefault ? <Tag color="gold">Principal</Tag> : null}
                </Space>
                <div>
                  <Typography.Text type="secondary">
                    {item.brand} • ****-{item.last4}
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    Validade {String(item.expMonth).padStart(2, "0")}/{String(item.expYear).slice(-2)}
                  </Typography.Text>
                </div>
              </div>
              <Space orientation="vertical" size={0} style={{ alignItems: "flex-end" }}>
                <Button
                  type="text"
                  size="small"
                  icon={item.isDefault ? <StarFilled style={{ color: "#faad14" }} /> : <StarOutlined />}
                  disabled={item.isDefault}
                  loading={
                    defaultMutation.isPending &&
                    defaultMutation.variables?.id === item.id
                  }
                  onClick={() => handleSetDefault(item.id)}
                >
                  {item.isDefault ? "Principal" : "Definir como principal"}
                </Button>
                <Popconfirm
                  title="Remover cartão"
                  okText="Remover"
                  cancelText="Cancelar"
                  onConfirm={() => handleDelete(item.id)}
                >
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={
                      deleteMutation.isPending &&
                      deleteMutation.variables === item.id
                    }
                  >
                    Remover
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      )}

      <CardModal
        open={showModal}
        loading={createMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={() => setShowModal(false)}
      />
    </Card>
  );
}
