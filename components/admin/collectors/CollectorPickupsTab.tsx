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
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CarOutlined,
  ShoppingOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { formatBRL } from "@/lib/utils/format";

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface PickupItem {
  id: string;
  status: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  scannedCode: string | null;
  scheduleAt: string | null;
  createdAt: string;
  shipment: {
    id: string;
    trackingCode: string;
    carrier: string | null;
    service: string | null;
    weight: number;
    declaredValue: number;
    recipientName: string | null;
    destinationCity: string | null;
    destinationState: string | null;
    pickupFee: number | null;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface PickupsResponse {
  items: PickupItem[];
  page: number;
  pageSize: number;
  total: number;
  stats: {
    totalPickups: number;
    totalKm: number;
    totalCommission: number;
    dateFrom: string;
    dateTo: string;
  };
}

interface CollectorPickupsTabProps {
  collectorId: string;
}

async function fetchPickups(
  collectorId: string,
  dateFrom: string,
  dateTo: string,
  page: number,
  pageSize: number
): Promise<PickupsResponse> {
  const params = new URLSearchParams({
    dateFrom,
    dateTo,
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  const res = await fetch(`/api/admin/coletores/${collectorId}/pickups?${params}`);
  if (!res.ok) {
    throw new Error("Erro ao carregar coletas");
  }
  const json = await res.json();
  return json.data ?? json;
}

const statusColors: Record<string, string> = {
  PENDING: "gold",
  SCHEDULED: "blue",
  COLLECTED: "cyan",
  COMPLETED: "green",
  FAILED: "red",
  CANCELED: "default",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  SCHEDULED: "Agendada",
  COLLECTED: "Coletada",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELED: "Cancelada",
};

export default function CollectorPickupsTab({ collectorId }: CollectorPickupsTabProps) {
  // Default: first day of current month to today
  const now = dayjs();
  const startOfMonth = now.startOf("month");

  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([startOfMonth, now]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const dateFrom = dateRange[0].format("YYYY-MM-DD");
  const dateTo = dateRange[1].format("YYYY-MM-DD");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "collector", collectorId, "pickups", dateFrom, dateTo, page, pageSize],
    queryFn: () => fetchPickups(collectorId, dateFrom, dateTo, page, pageSize),
    enabled: !!collectorId,
  });

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
      setPage(1); // Reset page when filter changes
    }
  };

  const columns: ColumnsType<PickupItem> = [
    {
      title: "Data da Coleta",
      key: "collectedAt",
      width: 150,
      render: (_, record) => (
        record.collectedAt
          ? dayjs(record.collectedAt).format("DD/MM/YYYY HH:mm")
          : "—"
      ),
    },
    {
      title: "Rastreio",
      key: "trackingCode",
      width: 160,
      render: (_, record) => (
        <Text copyable={{ text: record.shipment?.trackingCode || "" }}>
          {record.shipment?.trackingCode || "—"}
        </Text>
      ),
    },
    {
      title: "Origem",
      key: "origin",
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.originCity || "—"}/{record.originUf || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            CEP: {record.originCep}
          </Text>
        </Space>
      ),
    },
    {
      title: "Destino",
      key: "destination",
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>
            {record.shipment?.destinationCity || "—"}/
            {record.shipment?.destinationState || "—"}
          </Text>
          {record.shipment?.recipientName && (
            <Tooltip title="Destinatário">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.shipment.recipientName}
              </Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Remetente",
      key: "sender",
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.user?.name || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.user?.email}
          </Text>
        </Space>
      ),
    },
    {
      title: "Transportadora",
      key: "carrier",
      width: 140,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.shipment?.carrier || "—"}</Text>
          {record.shipment?.service && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.shipment.service}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_, record) => (
        <Tag color={statusColors[record.status] || "default"}>
          {statusLabels[record.status] || record.status}
        </Tag>
      ),
    },
    {
      title: "Comissão",
      key: "pickupFee",
      width: 100,
      align: "right",
      render: (_, record) => (
        <Text strong style={{ color: "#52c41a" }}>
          {formatBRL(record.shipment?.pickupFee || 0)}
        </Text>
      ),
    },
  ];

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
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
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total de Coletas"
              value={data?.stats.totalPickups || 0}
              prefix={<ShoppingOutlined />}
              styles={{ content: { color: "#1890ff" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Km Percorridos"
              value={data?.stats.totalKm || 0}
              prefix={<CarOutlined />}
              suffix="km"
              styles={{ content: { color: "#722ed1" } }}
            />
            {data?.stats.totalKm === 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                Sem dados de distância
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Comissões"
              value={data?.stats.totalCommission || 0}
              prefix={<DollarOutlined />}
              precision={2}
              formatter={(value) => formatBRL(value as number)}
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card>
        <Table<PickupItem>
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
            showTotal: (total) => `Total: ${total} coletas`,
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
