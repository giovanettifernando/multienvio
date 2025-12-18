"use client";

import { Typography } from "antd";
import type { Shipment } from '@/shared/types/shipment';
import { ShipmentStatusBadge } from "@/modules/shipments/ui/components/shipment-status-badge";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";

type Props = {
  data?: Shipment[];
  carregando?: boolean;
  tamanho?: "small" | "middle" | "large";
};

const moedaFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const columns: DataTableColumn<Shipment>[] = [
  {
    title: "Código de rastreio",
    dataIndex: "codigoRastreio",
    key: "codigoRastreio",
    render: (codigo: unknown) => (
      <Typography.Text strong>{String(codigo)}</Typography.Text>
    ),
  },
  {
    title: "Destinatário",
    dataIndex: "destinatario",
    key: "destinatario",
    render: (_valor: unknown, record: Shipment) => (
      <div>
        <Typography.Text>{record.destinatario}</Typography.Text>
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          {record.cidadeDestino}
        </Typography.Paragraph>
      </div>
    ),
  },
  {
    title: "Serviço",
    dataIndex: "servico",
    key: "servico",
    render: (servico: unknown) => <Typography.Text>{String(servico)}</Typography.Text>,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (_valor: unknown, record: Shipment) => (
      <ShipmentStatusBadge status={record.status} />
    ),
  },
  {
    title: "Prazo estimado",
    dataIndex: "prazoEstimado",
    key: "prazoEstimado",
  },
  {
    title: "Valor do frete",
    dataIndex: "valorFrete",
    key: "valorFrete",
    render: (valor: unknown) => moedaFormatter.format(Number(valor)),
  },
];

export function ShipmentsTable({
  data = [],
  carregando,
}: Props) {
  return (
    <DataTable<Shipment>
      data={data}
      columns={columns}
      rowKey="id"
      loading={carregando}
      compact={false}
      enableMobileCards={true}
      pagination={{ pageSize: 5, showSizeChanger: false }}
      emptyMessage="Nenhum envio encontrado para o filtro atual."
    />
  );
}
