"use client";

import React from "react";
import { Table, Empty } from "antd";
import { useWallet } from "@/hooks/useWallet";

export default function TransactionsTable() {
  const { data, isLoading } = useWallet();
  const rows = (data?.transactions ?? []).slice(0, 10);

  if (!rows.length && !isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center", background: "#fff", borderRadius: 8 }}>
        <Empty description="Não há dados" />
      </div>
    );
  }

  return (
    <Table
      size="middle"
      rowKey="id"
      loading={isLoading}
      dataSource={rows}
      pagination={false}
      columns={[
        { title: "Data", dataIndex: "date", render: (v: string) => new Date(v).toLocaleString() },
        { title: "Tipo", dataIndex: "type" },
        { title: "Origem", dataIndex: "origin" },
        { title: "Valor", dataIndex: "amount", render: (v: number) => `R$ ${v.toFixed(2)}` },
        { title: "Saldo após", dataIndex: "balanceAfter", render: (v: number) => `R$ ${v.toFixed(2)}` },
        { title: "Descrição", dataIndex: "description" },
      ]}
    />
  );
}
