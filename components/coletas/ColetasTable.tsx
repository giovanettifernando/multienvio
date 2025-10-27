"use client";

import { Table, Tag, Button, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import type { Coleta, ColetaStatus } from "@/lib/coletas/types";

interface ColetasTableProps {
  data: Coleta[];
  loading?: boolean;
  onReagendar: (coleta: Coleta) => void;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
}

const STATUS_COLORS: Record<ColetaStatus, string> = {
  agendada: "blue",
  reagendada: "orange",
  concluida: "success",
  cancelada: "error",
};

const STATUS_LABELS: Record<ColetaStatus, string> = {
  agendada: "Agendada",
  reagendada: "Reagendada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function ColetasTable({
  data,
  loading,
  onReagendar,
  pagination,
}: ColetasTableProps) {
  const formatDate = (dateString: string) => {
    return dayjs(dateString).format("DD/MM/YYYY");
  };

  const columns: ColumnsType<Coleta> = [
    {
      title: "Rastreio",
      dataIndex: "trackingCode",
      key: "trackingCode",
      width: 150,
      render: (trackingCode: string) => (
        <Link href={`/shipments?q=${trackingCode}`}>
          <Typography.Link strong>{trackingCode}</Typography.Link>
        </Link>
      ),
    },
    {
      title: "CEP Origem",
      dataIndex: "origemCep",
      key: "origemCep",
      width: 120,
      render: (cep: string) => <Typography.Text>{cep}</Typography.Text>,
    },
    {
      title: "CEP Destino",
      dataIndex: "destinoCep",
      key: "destinoCep",
      width: 120,
      render: (cep: string) => <Typography.Text>{cep}</Typography.Text>,
    },
    {
      title: "Data da Coleta",
      dataIndex: "scheduledFor",
      key: "scheduledFor",
      width: 140,
      sorter: (a, b) => a.scheduledFor.localeCompare(b.scheduledFor),
      render: (date: string) => (
        <Typography.Text strong>{formatDate(date)}</Typography.Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      filters: [
        { text: "Agendada", value: "agendada" },
        { text: "Reagendada", value: "reagendada" },
        { text: "Concluída", value: "concluida" },
        { text: "Cancelada", value: "cancelada" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: ColetaStatus) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 130,
      fixed: "right",
      render: (_, coleta) => (
        <Button
          type="link"
          icon={<CalendarOutlined />}
          onClick={() => onReagendar(coleta)}
          disabled={coleta.status === "concluida" || coleta.status === "cancelada"}
        >
          Reagendar
        </Button>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={
        pagination
          ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: pagination.onChange,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} coletas`,
            }
          : false
      }
      scroll={{ x: 800 }}
    />
  );
}
