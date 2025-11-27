"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Table,
  DatePicker,
  Space,
  Statistic,
  Row,
  Col,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  InboxOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { formatBRL } from "@/lib/utils/format";

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface ReceptionItem {
  id: string;
  trackingCode: string;
  senderName: string;
  recipientName: string;
  weight: number | null;
  declaredValue: number | null;
  status: string;
  expectedAt: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  issueType: string | null;
  issueDetails: string | null;
  commissionCents: number;
  createdAt: string;
}

interface ReceptionsResponse {
  items: ReceptionItem[];
  page: number;
  pageSize: number;
  total: number;
  stats: {
    totalReceptions: number;
    receivedCount: number;
    pendingCount: number;
    issueCount: number;
    totalCommission: number;
    dateFrom: string;
    dateTo: string;
  };
}

interface PickupPointReceptionsTabProps {
  pointId: string;
}

async function fetchReceptions(
  pointId: string,
  dateFrom: string,
  dateTo: string,
  page: number,
  pageSize: number
): Promise<ReceptionsResponse> {
  const params = new URLSearchParams({
    dateFrom,
    dateTo,
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  const res = await fetch(`/api/admin/pickup-points/${pointId}/receptions?${params}`);
  if (!res.ok) {
    throw new Error("Erro ao carregar recepções");
  }
  return res.json();
}

const statusColors: Record<string, string> = {
  PENDING: "gold",
  RECEIVED: "cyan",
  ISSUE_REPORTED: "red",
  PROCESSED: "green",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  RECEIVED: "Recebido",
  ISSUE_REPORTED: "Com Problema",
  PROCESSED: "Processado",
};

export default function PickupPointReceptionsTab({ pointId }: PickupPointReceptionsTabProps) {
  // Default: first day of current month to today
  const now = dayjs();
  const startOfMonth = now.startOf("month");

  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([startOfMonth, now]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const dateFrom = dateRange[0].format("YYYY-MM-DD");
  const dateTo = dateRange[1].format("YYYY-MM-DD");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pickup-point", pointId, "receptions", dateFrom, dateTo, page, pageSize],
    queryFn: () => fetchReceptions(pointId, dateFrom, dateTo, page, pageSize),
    enabled: !!pointId,
  });

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
      setPage(1);
    }
  };

  const columns: ColumnsType<ReceptionItem> = [
    {
      title: "Data",
      key: "createdAt",
      width: 140,
      render: (_, record) => dayjs(record.createdAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Rastreio",
      key: "trackingCode",
      width: 160,
      render: (_, record) => (
        <Text copyable={{ text: record.trackingCode }}>
          {record.trackingCode}
        </Text>
      ),
    },
    {
      title: "Remetente",
      dataIndex: "senderName",
      key: "senderName",
      ellipsis: true,
    },
    {
      title: "Destinatário",
      dataIndex: "recipientName",
      key: "recipientName",
      ellipsis: true,
    },
    {
      title: "Peso (kg)",
      key: "weight",
      width: 100,
      align: "right",
      render: (_, record) => (record.weight ? record.weight.toFixed(2) : "—"),
    },
    {
      title: "Valor Declarado",
      key: "declaredValue",
      width: 120,
      align: "right",
      render: (_, record) => (record.declaredValue ? formatBRL(record.declaredValue) : "—"),
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_, record) => (
        <Tag color={statusColors[record.status] || "default"}>
          {statusLabels[record.status] || record.status}
        </Tag>
      ),
    },
    {
      title: "Recebido em",
      key: "receivedAt",
      width: 140,
      render: (_, record) =>
        record.receivedAt ? dayjs(record.receivedAt).format("DD/MM/YYYY HH:mm") : "—",
    },
    {
      title: "Comissão",
      key: "commission",
      width: 100,
      align: "right",
      render: (_, record) => (
        <Text strong style={{ color: "#52c41a" }}>
          {formatBRL(record.commissionCents / 100)}
        </Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      {/* Filter */}
      <Card size="small">
        <Space>
          <Text strong>Período:</Text>
          <RangePicker
            value={dateRange}
            onChange={handleDateChange}
            format="DD/MM/YYYY"
            allowClear={false}
            presets={[
              { label: "Hoje", value: [dayjs(), dayjs()] },
              { label: "Últimos 7 dias", value: [dayjs().subtract(7, "day"), dayjs()] },
              { label: "Este mês", value: [dayjs().startOf("month"), dayjs()] },
              { label: "Mês passado", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
              { label: "Últimos 30 dias", value: [dayjs().subtract(30, "day"), dayjs()] },
              { label: "Últimos 90 dias", value: [dayjs().subtract(90, "day"), dayjs()] },
            ]}
          />
        </Space>
      </Card>

      {/* Stats Summary */}
      <Row gutter={16}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total de Recepções"
              value={data?.stats.totalReceptions || 0}
              prefix={<InboxOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Recebidos"
              value={data?.stats.receivedCount || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Pendentes"
              value={data?.stats.pendingCount || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#faad14" }}
            />
            {(data?.stats.issueCount || 0) > 0 && (
              <div style={{ marginTop: 4 }}>
                <Tag color="error" icon={<WarningOutlined />}>
                  {data?.stats.issueCount} com problema
                </Tag>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Comissões"
              value={data?.stats.totalCommission || 0}
              prefix={<DollarOutlined />}
              precision={2}
              formatter={(value) => formatBRL(value as number)}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card>
        <Table<ReceptionItem>
          rowKey="id"
          columns={columns}
          dataSource={data?.items || []}
          loading={isLoading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total: ${total} recepções`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </Space>
  );
}
