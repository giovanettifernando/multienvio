"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { ELCard } from '@/shared/ui/ELCard';
import type { ShipmentListItem } from '@/modules/shipments/application/list.service';
import type { Tracking } from '@/shared/types/tracking';
import { TrackingStatusTag } from "@/modules/tracking/ui/components/TrackingStatusTag";
import { PageShell } from '@/shared/ui/PageShell';
import { ELButton } from '@/shared/ui/ELButton';
import { ELInput } from '@/shared/ui/ELInput';
import { ELSelect } from '@/shared/ui/ELSelect';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { ActionBar } from '@/shared/ui/ActionBar';

/** Envio na forma que a tabela usa. */
type ShipmentRow = {
  id: string;
  codigo: string;
  servico: string;
  cidadeDestino: string;
  atualizadoEm: string;
};

async function fetchShipments(): Promise<{ dados: ShipmentRow[] }> {
  const response = await fetch("/api/shipments?limit=100");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os envios");
  }
  const json = await response.json();
  // A API devolve { data: { items, pagination } }
  const items: ShipmentListItem[] = json.data?.items ?? [];
  return {
    dados: items.map((item) => ({
      id: item.id,
      codigo: item.trackingCode,
      servico: [item.carrierName, item.serviceName].filter(Boolean).join(" "),
      cidadeDestino: item.recipientCityUf ?? "",
      atualizadoEm: item.postedAt ?? item.createdAt,
    })),
  };
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

type TrackingRow = ShipmentRow & {
  status: Tracking["status"];
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
        const termo = search.toLowerCase();
        const matchesSearch = search
          ? item.codigo.toLowerCase().includes(termo) || item.id.toLowerCase().includes(termo)
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
      dataIndex: "codigo",
      key: "codigo",
      showInCard: true,
      cardLabel: "Código",
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
