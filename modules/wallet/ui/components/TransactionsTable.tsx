"use client";

import React from "react";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { useWallet } from "@/modules/wallet/ui/hooks";
import { formatDateTimeBR } from "@/shared/utils/date";
import type { WalletTransactionDTO } from '@/shared/types/wallet-statement';

export default function TransactionsTable() {
  const { data, isLoading } = useWallet();
  const rows = data?.latestTransactions ?? [];

  const columns: DataTableColumn<WalletTransactionDTO>[] = [
    {
      title: "Data",
      dataIndex: "confirmedAt",
      key: "confirmedAt",
      render: (v: unknown) => {
        const dateStr = v as string | null;
        return (
          <span style={{ whiteSpace: "nowrap" }}>
            {formatDateTimeBR(dateStr)}
          </span>
        );
      },
    },
    {
      title: "Tipo",
      dataIndex: "typeLabel",
      key: "typeLabel",
    },
    {
      title: "Valor",
      dataIndex: "formattedAmount",
      key: "formattedAmount",
      render: (formatted: unknown, record: WalletTransactionDTO) => {
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
    },
  ];

  return (
    <DataTable<WalletTransactionDTO>
      data={rows}
      columns={columns}
      rowKey="id"
      loading={isLoading}
      pagination={false}
      compact
      emptyMessage="Nenhuma transação encontrada"
    />
  );
}
