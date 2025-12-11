"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { ELCard } from "@/components/ui/ELCard";
import type { Shipment } from "@/types/shipment";
import type { Tracking } from "@/types/tracking";
import { TrackingStatusTag } from "@/components/ui/TrackingStatusTag";
import { PageShell } from "@/components/shared/PageShell";
import { ELButton } from "@/components/ui/ELButton";
import { ELInput } from "@/components/ui/ELInput";
import { ELSelect } from "@/components/ui/ELSelect";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ActionBar } from "@/components/ui/ActionBar";

async function fetchShipments(): Promise<{ dados: Shipment[] }> {
  const response = await fetch("/api/shipments");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os envios");
  }
  const json = await response.json();
  // Handle standardized API response format { data: T, error, meta }
  return (json.data ?? json) as { dados: Shipment[] };
}

async function fetchTracking(shipmentId: string): Promise<Tracking> {
  const response = await fetch(`/api/tracking?shipmentId=${shipmentId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar rastreamento");
  }
  const json = await response.json();
  // Handle standardized API response format { data: T, error, meta }
  return (json.data ?? json) as Tracking;
}

const STATUS_FILTERS = [
  { label: "Todos", value: "todos" },
  { label: "Em trânsito", value: "IN_TRANSIT" },
  { label: "Saiu para entrega", value: "OUT_FOR_DELIVERY" },
  { label: "Entregue", value: "DELIVERED" },
  { label: "Ocorrência", value: "ISSUE" },
];

type TrackingRow = Omit<Shipment, "status"> & {
  status: Tracking["status"];
  atualizadoEm: string;
  ultimoEvento: string;
};

export default function RastreamentoClient() {
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

  const dataSource: TrackingRow[] = useMemo(() => {
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

  const columns: DataTableColumn<TrackingRow>[] = [
    {
      title: "Envio",
      dataIndex: "id",
      key: "id",
      showInCard: true,
      cardLabel: "ID",
    },
    {
      title: "Serviço",
      dataIndex: "servico",
      key: "servico",
      showInCard: true,
      cardLabel: "Serviço",
    },
    {
      title: "Destinatário",
      dataIndex: "cidadeDestino",
      key: "cidadeDestino",
      showInCard: true,
      cardLabel: "Destino",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      showInCard: true,
      cardLabel: "Status",
      render: (value) => (
        <TrackingStatusTag status={value as Tracking["status"]} />
      ),
    },
    {
      title: "Atualizado em",
      dataIndex: "atualizadoEm",
      key: "atualizadoEm",
      showInCard: true,
      cardLabel: "Atualizado",
      render: (value) =>
        new Date(value as string).toLocaleString("pt-BR"),
    },
    {
      title: "Último evento",
      dataIndex: "ultimoEvento",
      key: "ultimoEvento",
      showInCard: true,
      cardLabel: "Evento",
      ellipsis: true,
    },
    {
      title: "Ações",
      key: "actions",
      isActions: true,
      render: (_value, record) => (
        <ELButton variant="link" onClick={() => router.push(`/rastreamento/${record.id}`)}>
          Ver detalhes
        </ELButton>
      ),
    },
  ];

  return (
    <PageShell title="Rastreamento" gap="md">
      <ActionBar variant="compact">
        <ELInput.Search
          placeholder="Buscar por ID do envio"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => setSearch(value)}
          style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
        />
        <ELSelect
          style={{ minWidth: 160 }}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          options={STATUS_FILTERS}
          placeholder="Filtrar por status"
        />
      </ActionBar>

      <DataTable<TrackingRow>
        rowKey="id"
        data={dataSource}
        loading={shipmentsResult.isLoading}
        columns={columns}
        enableMobileCards
        scrollX={900}
        scrollY="calc(100vh - 340px)"
        emptyMessage="Nenhum rastreamento encontrado"
        emptyDescription="Tente ajustar os filtros de busca"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total} envios`,
        }}
      />
    </PageShell>
  );
}
