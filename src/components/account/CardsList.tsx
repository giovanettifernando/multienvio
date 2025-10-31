"use client";

import React, { useState } from "react";
import {
  App,
  Button,
  Card,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import { CreditCardOutlined } from "@ant-design/icons";
import type { Card as CardType } from "@/types/account";
import {
  useCards,
  useCardCreate,
  useCardDelete,
  useCardUpdate,
} from "@/hooks/useAccount";
import { CardModal, type CardFormValues } from "./CardModal";

export default function CardsList() {
  const { message } = App.useApp();
  const cardsQuery = useCards();
  const createMutation = useCardCreate();
  const [showModal, setShowModal] = useState(false);
  const deleteMutation = useCardDelete();
  const defaultMutation = useCardUpdate();

  const cards = cardsQuery.data ?? [];

  const handleSubmit = (values: CardFormValues) => {
    const digits = values.number.replace(/\D/g, "");
    const [monthPart = "", yearPart = ""] = values.exp.split("/");
    const monthSanitized = monthPart.trim();
    const yearSanitized = yearPart.trim();
    const expMonth = Number.parseInt(monthSanitized, 10);
    const rawYearNumber = Number.parseInt(yearSanitized, 10);
    const expYear =
      yearSanitized.length === 2 && Number.isInteger(rawYearNumber)
        ? 2000 + rawYearNumber
        : rawYearNumber;
    const payload = {
      holderName: values.holderName,
      number: digits,
      expMonth,
      expYear,
      cvv: values.cvv,
      document: values.document,
      isDefault: values.isDefault,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        message.success("Cartão adicionado.");
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
      <List
        loading={loading}
        dataSource={cards}
        locale={{ emptyText: "Nenhum cartão cadastrado." }}
        renderItem={(item: CardType) => (
          <List.Item
            actions={[
              <Button
                key="primary"
                type="link"
                disabled={item.isDefault}
                loading={
                  defaultMutation.isPending &&
                  defaultMutation.variables?.id === item.id
                }
                onClick={() => handleSetDefault(item.id)}
              >
                Definir como principal
              </Button>,
              <Popconfirm
                key="delete"
                title="Remover cartão"
                okText="Remover"
                cancelText="Cancelar"
                onConfirm={() => handleDelete(item.id)}
              >
                <Button
                  type="link"
                  danger
                  loading={
                    deleteMutation.isPending &&
                    deleteMutation.variables === item.id
                  }
                >
                  Remover
                </Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Typography.Text strong>{item.holderName}</Typography.Text>
                  {item.isDefault ? <Tag color="gold">Principal</Tag> : null}
                </Space>
              }
              description={
                <Space direction="vertical" size={0}>
                  <Typography.Text type="secondary">
                    {item.brand} • ****-{item.last4}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    Validade {String(item.expMonth).padStart(2, "0")}/{String(item.expYear).slice(-2)}
                  </Typography.Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />

      <CardModal
        open={showModal}
        loading={createMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={() => setShowModal(false)}
      />
    </Card>
  );
}
