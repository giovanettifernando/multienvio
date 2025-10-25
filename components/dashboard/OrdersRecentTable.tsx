"use client";

import { useMemo } from "react";
import { Button, Empty, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import type { Order } from "@/types/order";

type OrdersRecentTableProps = {
  orders: Order[] | undefined;
  loading?: boolean;
};

const statusLabels: Record<Order["status"], { label: string; color: string }> = {
  NEW: { label: "Novo", color: "processing" },
  QUOTED: { label: "Cotado", color: "cyan" },
  READY_TO_SHIP: { label: "Pronto para envio", color: "blue" },
  SHIPPED: { label: "Enviado", color: "gold" },
  DELIVERED: { label: "Entregue", color: "green" },
  CANCELED: { label: "Cancelado", color: "red" },
};

function formatCurrency(value: number | undefined): string {
  if (!value) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrdersRecentTable({ orders, loading }: OrdersRecentTableProps) {
  const router = useRouter();

  const dataSource = useMemo(() => {
    const sorted = (orders ?? []).slice().sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    return sorted.slice(0, 8);
  }, [orders]);

  const columns = useMemo<ColumnsType<Order>>(
    () => [
      {
        title: "Pedido",
        dataIndex: "id",
        key: "id",
        render: (value: string) => (
          <Typography.Text style={{ fontFamily: "monospace" }}>{value}</Typography.Text>
        ),
      },
      {
        title: "Cliente",
        dataIndex: ["customer", "name"],
        key: "customer",
      },
      {
        title: "Serviço",
        key: "service",
        render: (_, record) => record.selectedService?.serviceCode ?? "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status: Order["status"]) => {
          const meta = statusLabels[status];
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: "SLA",
        key: "sla",
        render: (_, record) => {
          const eta = record.selectedService?.etaDays;
          return eta ? `${eta} dia(s)` : "—";
        },
      },
      {
        title: "Custo",
        key: "cost",
        render: (_, record) => formatCurrency(record.selectedService?.price),
      },
      {
        title: "Ações",
        key: "actions",
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              onClick={() => router.push(`/pedidos/${record.id}`)}
              aria-label={`Abrir detalhes do pedido ${record.id}`}
            >
              Ver detalhes
            </Button>
          </Space>
        ),
      },
    ],
    [router],
  );

  return (
    <Table<Order>
      rowKey="id"
      dataSource={dataSource}
      columns={columns}
      loading={loading}
      pagination={false}
      locale={{
        emptyText: (
          <Empty
            description="Nenhum pedido recente"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ),
      }}
      scroll={{ x: 720 }}
    />
  );
}
