"use client";

import { useMemo } from "react";
import { Table } from "antd";
import type { TableColumnsType } from "antd";
import type { Shipment } from "@/types/shipment";

type Props = {
  shipments: Shipment[];
  selectedRowKeys: string[];
  onSelectionChange: (keys: string[]) => void;
};

const columns: TableColumnsType<Shipment> = [
  {
    title: "Envio",
    dataIndex: "id",
  },
  {
    title: "Serviço",
    dataIndex: "servico",
  },
  {
    title: "Destinatário",
    dataIndex: "cidadeDestino",
  },
  {
    title: "Peso",
    dataIndex: "pesoKg",
    render: (value?: number) => `${value ?? 1} kg`,
  },
];

export function PickupShipmentsTable({
  shipments,
  selectedRowKeys,
  onSelectionChange,
}: Props) {
  const rowSelection = useMemo(
    () => ({
      selectedRowKeys,
      onChange: (keys: React.Key[]) => onSelectionChange(keys as string[]),
    }),
    [onSelectionChange, selectedRowKeys],
  );

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={shipments}
      pagination={{ pageSize: 5 }}
      rowSelection={rowSelection}
      locale={{ emptyText: "Nenhum envio disponível" }}
    />
  );
}
