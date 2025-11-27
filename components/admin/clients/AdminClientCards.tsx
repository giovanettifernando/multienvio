"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Empty,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  CreditCardOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

interface Card {
  id: string;
  brand: string;
  holderName: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface AdminClientCardsProps {
  clientId: string;
  cards: Card[];
  onUpdate: () => void;
}

const brandIcons: Record<string, string> = {
  VISA: "💳 Visa",
  MASTERCARD: "💳 Mastercard",
  AMEX: "💳 Amex",
  ELO: "💳 Elo",
  HIPERCARD: "💳 Hipercard",
};

export default function AdminClientCards({
  clientId,
  cards,
  onUpdate,
}: AdminClientCardsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSetDefault = async (cardId: string) => {
    setLoading(cardId);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao definir cartão padrão");
      }

      message.success("Cartão definido como padrão");
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (cardId: string) => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/cards/${cardId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao remover cartão");
      }

      message.success("Cartão removido");
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro");
    }
  };

  const columns: ColumnsType<Card> = [
    {
      title: "Cartão",
      key: "card",
      render: (_, record) => (
        <Space>
          <CreditCardOutlined />
          <span>{brandIcons[record.brand] || `💳 ${record.brand}`}</span>
          <Text strong>**** {record.last4}</Text>
          {record.isDefault && (
            <Tag icon={<StarFilled />} color="gold">
              Padrão
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Titular",
      dataIndex: "holderName",
      key: "holderName",
    },
    {
      title: "Validade",
      key: "expiry",
      render: (_, record) => (
        <Text>
          {String(record.expMonth).padStart(2, "0")}/{record.expYear}
        </Text>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space>
          {!record.isDefault && (
            <Button
              type="text"
              icon={<StarOutlined />}
              onClick={() => handleSetDefault(record.id)}
              loading={loading === record.id}
              title="Definir como padrão"
            />
          )}
          <Popconfirm
            title="Remover cartão?"
            description="Esta ação não pode ser desfeita."
            onConfirm={() => handleDelete(record.id)}
            okText="Remover"
            cancelText="Cancelar"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (cards.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <p>Nenhum cartão cadastrado</p>
            <Text type="secondary">
              O administrador não pode adicionar cartões. O usuário deve
              cadastrar através da área de conta.
            </Text>
          </>
        }
      />
    );
  }

  return (
    <>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Os cartões são cadastrados pelo próprio usuário. O administrador pode
        apenas visualizar, definir como padrão ou remover.
      </Text>

      <Table
        columns={columns}
        dataSource={cards}
        rowKey="id"
        pagination={false}
      />
    </>
  );
}
