"use client";

import React from "react";
import { useEffect, useState } from "react";
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);

  const deleteMutation = useCardDelete(deleteId ?? "");
  const primaryMutation = useCardUpdate(primaryId ?? "");

  const cards = cardsQuery.data ?? [];

  const handleSubmit = (values: CardFormValues) => {
    const digits = values.number.replace(/\D/g, "");
    const [month, year] = values.exp.split("/");
    const payload = {
      holderName: values.holderName,
      number: digits,
      expMonth: Number(month),
      expYear: Number(year),
      cvv: values.cvv,
      document: values.document,
      isPrimary: values.isPrimary,
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

  useEffect(() => {
    if (!deleteId) return;
    deleteMutation.mutate(undefined, {
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
      onSettled: () => setDeleteId(null),
    });
  }, [deleteId, deleteMutation, message]);

  useEffect(() => {
    if (!primaryId) return;
    primaryMutation.mutate(
      { isPrimary: true },
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
        onSettled: () => setPrimaryId(null),
      },
    );
  }, [primaryId, primaryMutation, message]);

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
                disabled={item.isPrimary}
                loading={primaryId === item.id && primaryMutation.isPending}
                onClick={() => setPrimaryId(item.id)}
              >
                Definir como principal
              </Button>,
              <Popconfirm
                key="delete"
                title="Remover cartão"
                okText="Remover"
                cancelText="Cancelar"
                onConfirm={() => setDeleteId(item.id)}
              >
                <Button
                  type="link"
                  danger
                  loading={deleteId === item.id && deleteMutation.isPending}
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
                  {item.isPrimary ? <Tag color="gold">Principal</Tag> : null}
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
