"use client";

import React from "react";
import { Table, Empty } from "antd";
import type { WalletTransactionDTO } from "@/types/wallet-statement";

interface StatementTableProps {
  transactions: WalletTransactionDTO[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
    showSizeChanger?: boolean;
    showTotal?: (total: number) => string;
  };
}

export default function StatementTable({
  transactions,
  loading = false,
  pagination
}: StatementTableProps) {
  if (!transactions.length && !loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", background: "#fff", borderRadius: 8 }}>
        <Empty description="Nenhuma transação encontrada" />
      </div>
    );
  }

  return (
    <Table<WalletTransactionDTO>
      size="small"
      rowKey="id"
      loading={loading}
      dataSource={transactions}
      pagination={pagination}
      tableLayout="auto"
      columns={[
        {
          title: "Data",
          dataIndex: "confirmedAt",
          render: (v: string | null) => {
            const date = v ? new Date(v) : null;
            return (
              <span style={{ whiteSpace: "nowrap" }}>
                {date
                  ? date.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </span>
            );
          },
        },
        {
          title: "Tipo",
          dataIndex: "typeLabel",
        },
        {
          title: "Valor",
          dataIndex: "formattedAmount",
          render: (formatted: string, record: WalletTransactionDTO) => {
            const color = record.direction === "credit" ? "#52c41a" : "#ff4d4f";
            return (
              <span style={{ color, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>
                {formatted}
              </span>
            );
          },
        },
        {
          title: "Descrição",
          dataIndex: "description",
        },
      ]}
    />
  );
}
