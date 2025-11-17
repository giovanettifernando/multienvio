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
  const [status, setStatus] = useState<PickupStatus | "all">("all");
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
      render: (trackingCode: string, record) => (
        <Link href={`/shipments/${record.shipmentId}`}>
          {trackingCode}
        </Link>
      ),
    },
    {
      title: "Transportadora",
      dataIndex: ["shipment", "carrier"],
      render: (carrier: string | null | undefined, record) =>
        carrier || record.shipment?.service || "—",
    },
    {
      title: "CEP Origem",
      dataIndex: "originCep",
    },
    {
      title: "Cidade/UF",
      render: (_value, row) => {
        if (row.originCity && row.originUf) {
          return `${row.originCity}/${row.originUf}`;
        }
        if (row.originCity) return row.originCity;
        if (row.originUf) return row.originUf;
        return "—";
      },
    },
    {
      title: "Janela de Coleta",
      render: (_value, row) => {
        if (row.windowStart && row.windowEnd) {
          return (
            <Space direction="vertical" size={0}>
              <Typography.Text style={{ fontSize: 12 }}>
                {dayjs(row.windowStart).format("DD/MM/YYYY HH:mm")}
              </Typography.Text>
              <Typography.Text style={{ fontSize: 12 }}>
                até {dayjs(row.windowEnd).format("DD/MM/YYYY HH:mm")}
              </Typography.Text>
            </Space>
          );
        }
        if (row.windowStart) {
          return dayjs(row.windowStart).format("DD/MM/YYYY HH:mm");
        }
        return "Não definida";
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value: PickupStatus) => (
        <Tag color={STATUS_COLORS[value] ?? "default"}>
          {STATUS_LABELS[value] ?? value}
        </Tag>
      ),
    },
    {
      title: "Criado em",
      dataIndex: "createdAt",
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
    },
  ];

  return (
    <PageShell title="Solicitações de Coleta" gap="md">
      <Card>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space wrap>
            <Input
              allowClear
              style={{ width: 280 }}
              placeholder="Buscar por código de rastreio ou CEP"
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select
              style={{ width: 160 }}
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
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
