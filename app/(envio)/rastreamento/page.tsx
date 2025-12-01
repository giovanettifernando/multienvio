"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import {
  Button,
  Card,
  Input,
  Space,
  Table,
  Tag,
} from "antd";
import type { Shipment } from "@/types/shipment";
import type { Tracking } from "@/types/tracking";
import { TrackingStatusTag } from "@/components/ui/TrackingStatusTag";
import { PageShell } from "@/components/shared/PageShell";

async function fetchShipments(): Promise<{ dados: Shipment[] }> {
  const response = await fetch("/api/shipments");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os envios");
  }
  return response.json();
}

async function fetchTracking(shipmentId: string): Promise<Tracking> {
  const response = await fetch(`/api/tracking?shipmentId=${shipmentId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar rastreamento");
  }
  return response.json();
}

const STATUS_FILTERS = [
  { label: "Todos", value: "todos" },
  { label: "Em trânsito", value: "IN_TRANSIT" },
  { label: "Saiu para entrega", value: "OUT_FOR_DELIVERY" },
  { label: "Entregue", value: "DELIVERED" },
  { label: "Ocorrência", value: "ISSUE" },
];

export default function TrackingListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const shipmentsQuery = useMemo(() => ({
    queryKey: ["shipments", "tracking"],
    queryFn: fetchShipments,
  }), []);

  const shipmentsResult = useQueries({ queries: [shipmentsQuery] })[0];

  const trackingQueries = useQueries({
    queries:
      shipmentsResult.data?.dados.map((item) => ({
        queryKey: ["tracking", item.id],
        queryFn: () => fetchTracking(item.id).catch(() => null),
        enabled: shipmentsResult.isSuccess,
      })) ?? [],
  });

  const trackingMap = trackingQueries.reduce<Record<string, Tracking | null>>(
    (acc, result, index) => {
      const shipmentId = shipmentsResult.data?.dados[index].id;
      if (shipmentId) {
        acc[shipmentId] = result.data ?? null;
      }
      return acc;
    },
    {},
  );

  const dataSource = useMemo(() => {
    const list = shipmentsResult.data?.dados ?? [];
    return list
      .filter((item) => {
        const matchesSearch = search
          ? item.id.toLowerCase().includes(search.toLowerCase())
          : true;
        const tracking = trackingMap[item.id];
        const matchesStatus =
          statusFilter === "todos"
            ? true
            : tracking?.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .map((item) => {
        const tracking = trackingMap[item.id];
        const lastEvent = tracking?.events?.[0];
        return {
          ...item,
          status: tracking?.status ?? "CREATED",
          atualizadoEm: lastEvent?.occurredAt ?? item.atualizadoEm,
          ultimoEvento: lastEvent?.description ?? "Aguardando atualização",
        };
      });
  }, [shipmentsResult.data?.dados, search, statusFilter, trackingMap]);

  return (
    <PageShell title="Rastreamento" gap="md">
      <Card variant="borderless">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input.Search
              placeholder="Buscar por ID do envio"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: 1, minWidth: 180, maxWidth: 300 }}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map((filter) => (
                <Tag
                  key={filter.value}
                  color={statusFilter === filter.value ? "blue" : undefined}
                  onClick={() => setStatusFilter(filter.value)}
                  style={{ cursor: "pointer", margin: 0 }}
                >
                  {filter.label}
                </Tag>
              ))}
            </div>
          </div>
        </Space>
      </Card>

      <Card variant="borderless">
        <Table
          rowKey="id"
          dataSource={dataSource}
          loading={shipmentsResult.isLoading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 900 }}
          columns={[
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
              title: "Status",
              dataIndex: "status",
              render: (value: Tracking["status"]) => (
                <TrackingStatusTag status={value} />
              ),
            },
            {
              title: "Atualizado em",
              dataIndex: "atualizadoEm",
              render: (value: string) =>
                new Date(value).toLocaleString("pt-BR"),
            },
            {
              title: "Último evento",
              dataIndex: "ultimoEvento",
            },
            {
              title: "Ações",
              render: (_, record) => (
                <Button type="link" onClick={() => router.push(`/rastreamento/${record.id}`)}>
                  Ver detalhes
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </PageShell>
  );
}
