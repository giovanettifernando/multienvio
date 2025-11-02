"use client";

import React from "react";
import { Card, Button, Table, Tag } from "antd";
import { useWalletTransactions } from "@/hooks/useWalletTransactions";
import type { WalletTx } from "@/types/wallet";

const typeLabels: Record<string, string> = {
  TOPUP: "Recarga",
  PURCHASE: "Compra",
  REFUND: "Reembolso",
  WITHDRAW: "Saque",
  ADJUSTMENT: "Ajuste",
};

const statusColors: Record<string, string> = {
  PENDING: "warning",
  CONFIRMED: "success",
  FAILED: "error",
  CANCELED: "default",
};

export default function ExtratoPage() {
  const { data, isLoading } = useWalletTransactions(100);
  const rows = data?.transactions ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title="Extrato da carteira"
        extra={<Button onClick={() => window.print()}>Imprimir</Button>}
      >
        <Table<WalletTx>
          rowKey="id"
          loading={isLoading}
          dataSource={rows}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: "Data",
              dataIndex: "createdAt",
              render: (v: string) => new Date(v).toLocaleString("pt-BR"),
            },
            {
              title: "Tipo",
              dataIndex: "type",
              render: (type: string) => typeLabels[type] || type,
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (status: string) => (
                <Tag color={statusColors[status]}>{status}</Tag>
              ),
            },
            {
              title: "Valor",
              dataIndex: "amountReais",
              render: (v: number, record: WalletTx) => {
                const isCredit = record.amountCents > 0;
                return (
                  <span style={{ color: isCredit ? "#52c41a" : "#ff4d4f" }}>
                    {isCredit ? "+" : "-"} R$ {Math.abs(v).toFixed(2)}
                  </span>
                );
              },
            },
            {
              title: "Descrição",
              dataIndex: "title",
              render: (title: string | null) => title || "-",
            },
          ]}
        />
      </Card>
    </div>
  );
}
