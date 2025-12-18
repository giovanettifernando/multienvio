"use client";

import { Table, Typography } from "antd";
import type { TableProps } from "antd";

type ColumnsType<T> = TableProps<T>['columns'];
import type { Shipment } from "@/types/shipment";
import { ShipmentStatusBadge } from "@/components/ui/shipment-status-badge";

type Props = {
  data?: Shipment[];
  carregando?: boolean;
  tamanho?: "small" | "middle" | "large";
};

const moedaFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const columns: ColumnsType<Shipment> = [
  {
    title: "Código de rastreio",
    dataIndex: "codigoRastreio",
    key: "codigoRastreio",
    render: (codigo: string) => (
      <Typography.Text strong>{codigo}</Typography.Text>
    ),
  },
  {
    title: "Destinatário",
    dataIndex: "destinatario",
    key: "destinatario",
    render: (_valor, record) => (
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
    render: (servico: string) => <Typography.Text>{servico}</Typography.Text>,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (_valor, record) => (
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
    align: "right",
    render: (valor: number) => moedaFormatter.format(valor),
  },
];

export function ShipmentsTable({
  data = [],
  carregando,
  tamanho = "middle",
}: Props) {
  return (
    <Table
      size={tamanho}
      rowKey={(item) => item.id}
      columns={columns}
      dataSource={data}
      loading={carregando}
      pagination={{ pageSize: 5, showSizeChanger: false }}
      locale={{
        emptyText: "Nenhum envio encontrado para o filtro atual.",
      }}
      style={{ background: "#fff", borderRadius: 12 }}
    />
  );
}
