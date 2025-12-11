"use client";

import React from "react";
import type { WalletTransactionDTO } from "@/types/wallet-statement";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

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
  const columns: DataTableColumn<WalletTransactionDTO>[] = [
    {
      title: "Data",
      dataIndex: "confirmedAt",
      key: "confirmedAt",
      width: 160,
      showInCard: true,
      cardLabel: "Data",
      render: (v) => {
        const date = v ? new Date(v as string) : null;
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
      key: "typeLabel",
      width: 120,
      showInCard: true,
      cardLabel: "Tipo",
    },
    {
      title: "Valor",
      dataIndex: "formattedAmount",
      key: "formattedAmount",
      width: 130,
      showInCard: true,
      cardLabel: "Valor",
      render: (formatted, record) => {
        const color = record.direction === "credit" ? "#52c41a" : "#ff4d4f";
        return (
          <span style={{ color, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>
            {formatted as string}
          </span>
        );
      },
    },
    {
      title: "Descrição",
      dataIndex: "description",
      key: "description",
      showInCard: true,
      cardLabel: "Descrição",
      render: (v) => (v as string) || "-",
    },
  ];

  return (
    <DataTable<WalletTransactionDTO>
      rowKey="id"
      loading={loading}
      data={transactions}
      columns={columns}
      enableMobileCards
      scrollX={600}
      scrollY="calc(100vh - 400px)"
      emptyMessage="Nenhuma transação encontrada"
      emptyDescription="Ajuste os filtros para ver suas transações"
      pagination={
        pagination
          ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: pagination.onChange,
              showSizeChanger: pagination.showSizeChanger,
              showTotal: pagination.showTotal,
            }
          : undefined
      }
    />
  );
}
