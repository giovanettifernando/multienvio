"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Flex,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { Pickup } from "@/types/pickup";
import { PickupStatusTag } from "@/components/ui/PickupStatusTag";

async function fetchPickups(): Promise<{ dados: Pickup[] }> {
  const response = await fetch("/api/pickups");
  if (!response.ok) {
    throw new Error("Não foi possível carregar coletas");
  }
  return response.json();
}

const STATUS_FILTERS = [
  { label: "Todas", value: "todos" },
  { label: "Solicitadas", value: "REQUESTED" },
  { label: "Agendadas", value: "SCHEDULED" },
  { label: "Atribuídas", value: "ASSIGNED" },
  { label: "Coletadas", value: "PICKED_UP" },
  { label: "Falha", value: "FAILED" },
];

export default function PickupsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["pickups"],
    queryFn: fetchPickups,
  });

  const tableData = useMemo(() => {
    const list = data?.dados ?? [];
    return list
      .filter((pickup) => {
        const matchesSearch = search
          ? pickup.id.toLowerCase().includes(search.toLowerCase()) ||
            pickup.schedule.date.includes(search)
          : true;
        const matchesStatus =
          statusFilter === "todos" ? true : pickup.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .map((pickup) => ({
        key: pickup.id,
        ...pickup,
      }));
  }, [data?.dados, search, statusFilter]);

  return (
    <Flex vertical gap={24}>
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Coletas
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Solicitações de coleta programadas com transportadoras parceiras.
        </Typography.Paragraph>
      </Space>

      <Card variant="borderless">
        <Flex gap={16} wrap align="center">
          <Input.Search
            placeholder="Buscar por ID ou data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 260 }}
          />

          <Space>
            {STATUS_FILTERS.map((filter) => (
              <Tag
                key={filter.value}
                color={statusFilter === filter.value ? "blue" : undefined}
                onClick={() => setStatusFilter(filter.value)}
                style={{ cursor: "pointer" }}
              >
                {filter.label}
              </Tag>
            ))}
          </Space>

          <Button type="primary" onClick={() => router.push("/coletas/nova")}>Nova coleta</Button>
        </Flex>
      </Card>

      <Card variant="borderless">
        <Table
          loading={isLoading}
          dataSource={tableData}
          pagination={{ pageSize: 6 }}
          columns={[
            {
              title: "Coleta",
              dataIndex: "id",
            },
            {
              title: "Data",
              dataIndex: "schedule",
              render: (value: Pickup["schedule"]) =>
                `${value.date} · ${value.windowStart} - ${value.windowEnd}`,
            },
            {
              title: "Envios",
              dataIndex: ["totals", "count"],
            },
            {
              title: "Peso total",
              dataIndex: ["totals", "weightKg"],
              render: (value: number) => `${value.toFixed(2)} kg`,
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (value: Pickup["status"]) => <PickupStatusTag status={value} />,
            },
            {
              title: "Ações",
              render: (_, record: Pickup) => (
                <Button type="link" onClick={() => router.push(`/coletas/${record.id}`)}>
                  Ver detalhes
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
