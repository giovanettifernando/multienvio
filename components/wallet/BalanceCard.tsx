"use client";

import React from "react";
import { Button, Card, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useWallet } from "@/hooks/useWallet";

export default function BalanceCard({ onAddFunds }: { onAddFunds: () => void }) {
  const { data, isLoading } = useWallet();

  const available = data?.available ?? 0;
  const pending = data?.pending ?? 0;

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Saldo disponível - destaque forte */}
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
            Saldo disponível
          </Typography.Text>
          <Typography.Title
            level={1}
            style={{
              margin: "8px 0",
              fontSize: 48,
              fontWeight: 700,
              color: "#1890ff"
            }}
          >
            R$ {available.toFixed(2)}
          </Typography.Title>
        </div>

        {/* Saldo pendente (se houver) */}
        {pending > 0 && (
          <Typography.Text type="secondary">
            + R$ {pending.toFixed(2)} pendente
          </Typography.Text>
        )}

        {/* Botão de adicionar saldo - bem visível */}
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={onAddFunds}
          block
          loading={isLoading}
        >
          Adicionar saldo
        </Button>
      </Space>
    </Card>
  );
}
