"use client";

import React, { useMemo, useState } from "react";
import {
  Typography,
  Button,
  Tag,
  Table,
  Input,
  Segmented,
  Space,
  Tooltip,
} from "antd";
import {
  PrinterOutlined,
  SearchOutlined,
  EyeOutlined,
  StopOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useShipments, useShipmentCancel } from "@/hooks/useShipments";
import type { Shipment, ShipmentStatus } from "@/src/types/shipments";
import type { ColumnsType } from "antd/es/table";

const STATUS_OPTIONS: Array<ShipmentStatus | "Todos"> = [
  "Todos",
  "Aguardando coleta",
  "Postado",
  "Em trânsito",
  "Em rota de entrega",
  "Entregue",
  "Cancelado",
];

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  "Aguardando coleta": "default",
  Postado: "geekblue",
  "Em trânsito": "blue",
  "Em rota de entrega": "gold",
  Entregue: "green",
  Cancelado: "red",
};

export default function ShipmentsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "Todos">("Todos");
  const { data, isLoading, refetch } = useShipments({ q: query, status });
  const cancelMut = useShipmentCancel();

  const items = data?.items ?? [];

  const columns: ColumnsType<Shipment> = useMemo(
    () => [
      { title: "Código de rastreio", dataIndex: "trackingCode" },
      {
        title: "Destinatário",
        render: (_value, row) => {
          const name = row.recipientName ?? "";
          const locality = row.recipientCityUf ?? "";

          if (name && locality) {
            return <span>{name} · {locality}</span>;
          }
          if (name) return <span>{name}</span>;
          if (locality) return <span>{locality}</span>;
          return <span>—</span>;
        },
      },
      {
        title: "Transportadora",
        render: (_value, row) => row.carrierName ?? row.serviceName ?? "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (value: ShipmentStatus) => (
          <Tag color={STATUS_COLORS[value] ?? "default"}>{value}</Tag>
        ),
      },
      {
        title: "Data prevista de entrega",
        render: (_value, row) => {
          const baseDate = row.expectedDeliveryDate
            ? new Date(row.expectedDeliveryDate)
            : new Date(new Date(row.createdAt).getTime() + row.etaDays * 86_400_000);
          return baseDate.toLocaleDateString();
        },
      },
      {
        title: "Valor do frete",
        dataIndex: "freightValue",
        render: (value: number) => `R$ ${Number(value ?? 0).toFixed(2)}`,
      },
      {
        title: "Ações",
        render: (_value, row) => (
          <Space>
            <Tooltip title="Detalhes do envio">
              <Link href={`/shipments/${row.id}`}>
                <Button size="small" icon={<EyeOutlined />} />
              </Link>
            </Tooltip>
            <Tooltip title="Imprimir etiqueta">
              <span>
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  disabled={!row.labelUrl}
                  onClick={() => {
                    if (row.labelUrl) window.open(row.labelUrl, "_blank");
                  }}
                />
              </span>
            </Tooltip>
            <Tooltip title="Rastrear entrega">
              <span>
                <Button
                  size="small"
                  icon={<GlobalOutlined />}
                  disabled={!row.trackingUrl}
                  onClick={() => {
                    if (row.trackingUrl) window.open(row.trackingUrl, "_blank");
                  }}
                />
              </span>
            </Tooltip>
            <Tooltip title="Cancelar envio">
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                disabled={row.status === "Cancelado" || row.status === "Entregue"}
                loading={cancelMut.isPending}
                onClick={() => cancelMut.mutate(row.id)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [cancelMut],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Gestão de envios
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Monitore o status de cada pedido e atue rapidamente em casos críticos.
        </Typography.Paragraph>
      </div>

      <Space wrap>
        <Input
          allowClear
          style={{ width: 320 }}
          placeholder="Buscar por ID, rastreio, nome ou data (YYYY-MM-DD)"
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Segmented
          size="middle"
          value={status}
          onChange={(value) => setStatus(value as ShipmentStatus | "Todos")}
          options={STATUS_OPTIONS}
        />
        <Button onClick={() => refetch()} disabled={isLoading}>
          Atualizar
        </Button>
      </Space>

      <Table<Shipment>
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={columns}
      />
    </div>
  );
}
