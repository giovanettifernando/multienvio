"use client";

import React, { useState } from "react";
import { DatePicker } from "antd";
import { ELCard } from "@/components/ui/ELCard";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { PickupRequestWithShipment, PickupStatus } from "@/lib/types/pickup";
import dayjs, { type Dayjs } from "dayjs";
import { PageShell } from "@/components/shared/PageShell";
import { ELButton } from "@/components/ui/ELButton";
import { ELInput } from "@/components/ui/ELInput";
import { ELSelect } from "@/components/ui/ELSelect";
import { ELStatusTag, type StatusVariant } from "@/components/ui/ELStatusTag";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ActionBar } from "@/components/ui/ActionBar";
import tableStyles from "@/components/ui/ELTableWrapper.module.css";

const { RangePicker } = DatePicker;

const STATUS_OPTIONS: Array<{ label: string; value: PickupStatus | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "Pendente", value: "PENDING" },
  { label: "Agendada", value: "SCHEDULED" },
  { label: "Falhou", value: "FAILED" },
  { label: "Cancelada", value: "CANCELED" },
  { label: "Concluída", value: "COMPLETED" },
];

const STATUS_VARIANTS: Record<PickupStatus, StatusVariant> = {
  PENDING: "warning",
  SCHEDULED: "processing",
  FAILED: "danger",
  CANCELED: "default",
  COMPLETED: "success",
};

const STATUS_LABELS: Record<PickupStatus, string> = {
  PENDING: "Pendente",
  SCHEDULED: "Agendada",
  FAILED: "Falhou",
  CANCELED: "Cancelada",
  COMPLETED: "Concluída",
};

export default function ColetasClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<PickupStatus | "all">("all");
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pickups", searchQuery, status, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (status !== "all") params.append("status", status);
      if (dateRange[0]) params.append("dateStart", dateRange[0].toISOString());
      if (dateRange[1]) params.append("dateEnd", dateRange[1].toISOString());

      const response = await fetch(`/api/coletas?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Erro ao buscar coletas");
      }
      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return json.data ?? json;
    },
  });

  const items = data?.items ?? [];

  const columns: DataTableColumn<PickupRequestWithShipment>[] = [
    {
      title: "Código de rastreio",
      dataIndex: "shipment.trackingCode",
      key: "trackingCode",
      width: 180,
      showInCard: true,
      cardLabel: "Rastreio",
      render: (_value, record) => (
        <Link href={`/shipments/${record.shipmentId}`} style={{ fontWeight: 500 }}>
          {record.shipment?.trackingCode ?? "—"}
        </Link>
      ),
    },
    {
      title: "Nome do Coletor",
      key: "collector",
      width: 200,
      showInCard: true,
      cardLabel: "Coletor",
      render: (_value, row) => {
        if (row.collector) {
          return row.collector.name;
        }
        return <span style={{ color: '#8c8c8c' }}>Não atribuído</span>;
      },
    },
    {
      title: "Data e hora agendadas",
      dataIndex: "scheduleAt",
      key: "scheduleAt",
      width: 180,
      showInCard: true,
      cardLabel: "Agendamento",
      render: (value) => {
        if (value) {
          return dayjs(value as string).format("DD/MM/YYYY HH:mm");
        }
        return <span style={{ color: '#8c8c8c' }}>Não agendado</span>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      showInCard: true,
      cardLabel: "Status",
      render: (value) => (
        <ELStatusTag variant={STATUS_VARIANTS[value as PickupStatus] ?? "default"}>
          {STATUS_LABELS[value as PickupStatus] ?? value}
        </ELStatusTag>
      ),
    },
    {
      title: "Tentativas de Coleta",
      dataIndex: "attemptCount",
      key: "attemptCount",
      width: 150,
      showInCard: true,
      cardLabel: "Tentativas",
      render: (count) => {
        const num = count as number;
        if (num === 0) return "0";
        if (num === 1) return "1 tentativa";
        return `${num} tentativas`;
      },
    },
  ];

  return (
    <PageShell title="Gerenciar Coletas" gap="md">
      <div className={tableStyles.wrapper}>
        <ELCard>
          <ActionBar
            extraActions={[
              {
                key: "refresh",
                label: "Atualizar",
                onClick: () => refetch(),
                disabled: isLoading,
              },
            ]}
          >
            <ELInput.Search
              allowClear
              placeholder="Buscar por código de rastreio"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={(value) => setSearchQuery(value)}
            />
            <ELSelect
              style={{ minWidth: 140 }}
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              placeholder="Filtrar por status"
            />
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={["Data início", "Data fim"]}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
              style={{ minWidth: 220 }}
            />
          </ActionBar>

          <DataTable<PickupRequestWithShipment>
            rowKey="id"
            loading={isLoading}
            data={items}
            columns={columns}
            enableMobileCards
            scrollX={900}
            emptyMessage="Nenhuma coleta encontrada"
            emptyDescription="Tente ajustar os filtros de busca"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} coletas`,
            }}
          />
        </ELCard>
      </div>
    </PageShell>
  );
}
