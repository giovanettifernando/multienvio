"use client";

import React, { useState } from "react";
import {
  Table,
  Tag,
  Space,
  Input,
  DatePicker,
  Select,
  Button,
  Card,
  Typography,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import type { PickupRequestWithShipment, PickupStatus } from "@/lib/types/pickup";
import dayjs, { type Dayjs } from "dayjs";
import { PageShell } from "@/components/shared/PageShell";

const { RangePicker } = DatePicker;

const STATUS_OPTIONS: Array<{ label: string; value: PickupStatus | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "Pendente", value: "PENDING" },
  { label: "Agendada", value: "SCHEDULED" },
  { label: "Falhou", value: "FAILED" },
  { label: "Cancelada", value: "CANCELED" },
  { label: "Concluída", value: "COMPLETED" },
];

const STATUS_COLORS: Record<PickupStatus, string> = {
  PENDING: "orange",
  SCHEDULED: "blue",
  FAILED: "red",
  CANCELED: "default",
  COMPLETED: "green",
};

const STATUS_LABELS: Record<PickupStatus, string> = {
  PENDING: "Pendente",
  SCHEDULED: "Agendada",
  FAILED: "Falhou",
  CANCELED: "Cancelada",
  COMPLETED: "Concluída",
};

export default function ColetasPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<PickupStatus | "all">("PENDING"); // Padrão: apenas pendentes
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  // Fetch pickups with filters
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
      return response.json();
    },
  });

  const items = data?.items ?? [];

  const columns: ColumnsType<PickupRequestWithShipment> = [
    {
      title: "Código de rastreio",
      dataIndex: ["shipment", "trackingCode"],
      width: 180,
      render: (trackingCode: string, record) => (
        <Link href={`/shipments/${record.shipmentId}`} style={{ fontWeight: 500 }}>
          {trackingCode}
        </Link>
      ),
    },
    {
      title: "Nome do Coletor",
      key: "collector",
      width: 200,
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
      width: 180,
      render: (value: string | null) => {
        if (value) {
          return dayjs(value).format("DD/MM/YYYY HH:mm");
        }
        return <span style={{ color: '#8c8c8c' }}>Não agendado</span>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (value: PickupStatus) => (
        <Tag color={STATUS_COLORS[value] ?? "default"}>
          {STATUS_LABELS[value] ?? value}
        </Tag>
      ),
    },
    {
      title: "Tentativas de Coleta",
      dataIndex: "attemptCount",
      width: 150,
      align: "center",
      render: (count: number) => {
        if (count === 0) {
          return "0";
        } else if (count === 1) {
          return "1 tentativa";
        } else {
          return `${count} tentativas`;
        }
      },
    },
  ];

  return (
    <PageShell title="Minhas Coletas Pendentes" gap="md">
      <Card>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space wrap>
            <Input
              allowClear
              style={{ width: 280 }}
              placeholder="Buscar por código de rastreio"
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select
              style={{ width: 160 }}
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
            />
            <Button onClick={() => refetch()} disabled={isLoading}>
              Atualizar
            </Button>
          </Space>

          <Table<PickupRequestWithShipment>
            rowKey="id"
            loading={isLoading}
            dataSource={items}
            pagination={{ pageSize: 20 }}
            columns={columns}
          />
        </Space>
      </Card>
    </PageShell>
  );
}
