"use client";

import { Table } from "antd";
import type { LedgerEntry } from "@/types/billing";

type Props = {
  data: LedgerEntry[];
  loading?: boolean;
};

export function TransactionTable({ data, loading }: Props) {
  return (
    <Table
      rowKey="id"
      loading={loading}
      dataSource={data}
      pagination={{ pageSize: 10 }}
      columns={[
        {
          title: "Data",
          dataIndex: "occurredAt",
          render: (value: string) => new Date(value).toLocaleString("pt-BR"),
        },
        {
          title: "Tipo",
          dataIndex: "type",
        },
        {
          title: "Origem",
          dataIndex: "source",
        },
        {
          title: "Valor",
          dataIndex: "amount",
          render: (value: number) =>
            value.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
        },
        {
          title: "Saldo após",
          dataIndex: "balanceAfter",
          render: (value: number) =>
            value.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
        },
        {
          title: "Descrição",
          dataIndex: "description",
        },
      ]}
    />
  );
}
