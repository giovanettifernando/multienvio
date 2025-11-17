"use client";

import React, { useMemo, useState } from "react";
import {
  Button,
  Tag,
  Table,
  Input,
  Segmented,
  Space,
  Tooltip,
  App,
} from "antd";
import {
  PrinterOutlined,
  SearchOutlined,
  EyeOutlined,
  StopOutlined,
  GlobalOutlined,
  CarOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useShipments, useShipmentCancel } from "@/hooks/useShipments";
import type { Shipment, ShipmentStatus } from "@/src/types/shipments";
import type { LabelItem } from "@/lib/types/label";
import type { ColumnsType } from "antd/es/table";
import { PageShell } from "@/components/shared/PageShell";

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
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "Todos">("Todos");
  const { data, isLoading, refetch } = useShipments({ q: query, status });
  const cancelMut = useShipmentCancel();

  const items = data?.items ?? [];

  // Função para imprimir etiqueta e marcar como impressa
  const handlePrintLabel = async (shipmentId: string, labelUrl: string) => {
    try {
      // Abrir etiqueta para impressão
      window.open(labelUrl, "_blank");

      // Buscar ID da label associada ao shipment
      const response = await fetch(`/api/labels?q=${shipmentId}`);
      if (response.ok) {
        const data = await response.json();
        const label = data.items?.find((item: LabelItem) => item.shipmentId === shipmentId);

        if (label) {
          // Marcar como impressa
          await fetch(`/api/labels?id=${label.id}`, {
            method: 'PATCH',
          });
          message.success('Etiqueta marcada como impressa');
          refetch();
        }
      }
    } catch (error) {
      console.error('Erro ao imprimir etiqueta:', error);
    }
  };

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
        render: (value: ShipmentStatus, row: Shipment) => (
          <Space direction="vertical" size={4}>
            <Tag color={STATUS_COLORS[value] ?? "default"}>{value}</Tag>
            {row.pickupRequest && row.pickupRequest.status !== 'CANCELED' && row.pickupRequest.status !== 'COMPLETED' && (
              <Tag color={row.pickupRequest.status === 'PENDING' ? 'orange' : 'blue'} style={{ fontSize: 11 }}>
                Coleta: {row.pickupRequest.status === 'PENDING' ? 'Pendente' : row.pickupRequest.status === 'SCHEDULED' ? 'Agendada' : row.pickupRequest.status}
              </Tag>
            )}
          </Space>
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
                    if (row.labelUrl) handlePrintLabel(row.id, row.labelUrl);
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
            {row.pickupRequest && (
              <Tooltip title="Ver coleta">
                <Link href={`/coletas?shipmentId=${row.id}`}>
                  <Button size="small" icon={<CarOutlined />} />
                </Link>
              </Tooltip>
            )}
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
    <PageShell title="Gestão de envios" gap="md">
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
    </PageShell>
  );
}
