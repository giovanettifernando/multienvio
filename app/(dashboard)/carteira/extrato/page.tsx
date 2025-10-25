"use client";

import React from "react";
import { Card, Button, Table } from "antd";
import { useWallet } from "@/hooks/useWallet";

export default function ExtratoPage() {
  const { data, isLoading } = useWallet();
  const rows = data?.transactions ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title="Extrato da carteira"
        extra={<Button onClick={() => window.print()}>Imprimir</Button>}
      >
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={rows}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "Data", dataIndex: "date", render: (v: string) => new Date(v).toLocaleString() },
            { title: "Tipo", dataIndex: "type" },
            { title: "Origem", dataIndex: "origin" },
            { title: "Valor", dataIndex: "amount", render: (v: number) => `R$ ${v.toFixed(2)}` },
            { title: "Saldo após", dataIndex: "balanceAfter", render: (v: number) => `R$ ${v.toFixed(2)}` },
            { title: "Descrição", dataIndex: "description" },
          ]}
        />
      </Card>
    </div>
  );
}
