"use client";

import React from "react";
import { Card, Typography } from "antd";
import { useWallet } from "@/hooks/useWallet";

export default function BalanceCard({ onAddFunds }: { onAddFunds: () => void }) {
  const { data } = useWallet();
  const balance = data?.balance ?? 0;
  return (
    <Card
      title="Saldo disponível"
      extra={
        <Typography.Link onClick={onAddFunds}>Adicionar saldo</Typography.Link>
      }
    >
      <Typography.Title level={1}>R$ {balance.toFixed(2)}</Typography.Title>
      <Typography.Text type="danger">
        Saldo baixo — recarregue para continuar emitindo etiquetas
      </Typography.Text>
    </Card>
  );
}
