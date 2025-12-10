'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Tag,
  Space,
  Input,
  Select,
  Button,
  Flex,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  DatePicker,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import {
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  CarOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface PoCQueueItem {
  id: string;
  status: string;
  trackingCode: string;
  carrierTrackingCode: string | null;
  carrier: string | null;
  service: string | null;
  senderName: string | null;
  recipientName: string | null;
  weight: number;
  declaredValue: number | null;
  originCep: string;
  destinationCity: string;
  destinationState: string;
  pickupFee: number | null;
  receivedAt: string | null;
  receivedBy: string | null;
  createdAt: string;
  pickupPoint: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  } | null;
  sender: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  } | null;
}

interface PoCQueueResponse {
  items: PoCQueueItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    totalCommission: number;
    byStatus: Record<string, number>;
  };
}

interface PickupPointOption {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  AWAITING_DROP_OFF_AT_POINT: { label: 'Aguardando Entrega', color: 'orange', icon: <ClockCircleOutlined /> },
  DROPPED_OFF_AT_POINT: { label: 'Entregue no Ponto', color: 'blue', icon: <InboxOutlined /> },
  RECEIVED_AT_POINT: { label: 'Recebido', color: 'cyan', icon: <CheckCircleOutlined /> },
  AWAITING_CARRIER_PICKUP_AT_POINT: { label: 'Aguardando Coleta', color: 'purple', icon: <CarOutlined /> },
  COLLECTED_FROM_POINT: { label: 'Coletado', color: 'green', icon: <SendOutlined /> },
};

async function fetchPoCQueue(params: {
  page: number;
  pageSize: number;
  status?: string;
  pickupPointId?: string;
  dateStart?: string;
  dateEnd?: string;
  q?: string;
}): Promise<PoCQueueResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', params.page.toString());
  searchParams.set('pageSize', params.pageSize.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.pickupPointId) searchParams.set('pickupPointId', params.pickupPointId);
  if (params.dateStart) searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd) searchParams.set('dateEnd', params.dateEnd);
  if (params.q) searchParams.set('q', params.q);

  const res = await fetch(`/api/admin/ops/receptions?${searchParams}`, {
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Erro ao carregar fila dos pontos de coleta');
  const json = await res.json();
  return json.data ?? json;
}

async function fetchPickupPoints(): Promise<PickupPointOption[]> {
  const res = await fetch('/api/admin/pickup-points?pageSize=100', {
    credentials: 'include',
  });

  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data ?? json;
  return (data.items || []).map((p: { id: string; nomeFantasia: string }) => ({
    id: p.id,
    name: p.nomeFantasia,
  }));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD/MM/YYYY HH:mm');
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

interface ReceptionsTableProps {
  dateStart?: string;
  dateEnd?: string;
}

export default function ReceptionsTable({ dateStart, dateEnd }: ReceptionsTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [pickupPointId, setPickupPointId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(
    dateStart && dateEnd
      ? [dayjs(dateStart), dayjs(dateEnd)]
      : null
  );

  // Fetch pickup points for filter
  const { data: pickupPoints } = useQuery<PickupPointOption[]>({
    queryKey: ['admin', 'pickup-points', 'list'],
    queryFn: fetchPickupPoints,
  });

  const { data, isLoading, refetch } = useQuery<PoCQueueResponse>({
    queryKey: [
      'admin',
      'ops',
      'poc-queue',
      page,
      pageSize,
      status,
      pickupPointId,
      search,
      dateRange?.[0]?.format('YYYY-MM-DD'),
      dateRange?.[1]?.format('YYYY-MM-DD'),
    ],
    queryFn: () =>
      fetchPoCQueue({
        page,
        pageSize,
        status: status !== 'all' ? status : undefined,
        pickupPointId: pickupPointId !== 'all' ? pickupPointId : undefined,
        dateStart: dateRange?.[0]?.format('YYYY-MM-DD'),
        dateEnd: dateRange?.[1]?.format('YYYY-MM-DD'),
        q: search || undefined,
      }),
  });

  const columns = useMemo<ColumnsType<PoCQueueItem>>(
    () => [
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 150,
        render: (status: string) => {
          const config = STATUS_CONFIG[status] || { label: status, color: 'default', icon: null };
          return (
            <Tag color={config.color} icon={config.icon}>
              {config.label}
            </Tag>
          );
        },
      },
      {
        title: 'Código Rastreio',
        key: 'trackingCode',
        width: 180,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text strong style={{ fontSize: 12 }}>
              {record.trackingCode}
            </Text>
            {record.carrier && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.carrier} {record.service && `• ${record.service}`}
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Ponto de Coleta',
        key: 'pickupPoint',
        width: 180,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              {record.pickupPoint?.name || 'N/A'}
            </Text>
            {record.pickupPoint?.city && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.pickupPoint.city}/{record.pickupPoint.state}
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Remetente',
        key: 'sender',
        width: 150,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{record.senderName || record.sender?.name || '-'}</Text>
            {record.sender?.email && (
              <Tooltip title={record.sender.email}>
                <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                  {record.sender.email.substring(0, 20)}...
                </Text>
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: 'Destinatário',
        key: 'recipient',
        width: 150,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{record.recipientName || '-'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.destinationCity}/{record.destinationState}
            </Text>
          </Space>
        ),
      },
      {
        title: 'Peso/Valor',
        key: 'weightValue',
        width: 100,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text style={{ fontSize: 11 }}>{record.weight?.toFixed(2) || '-'} kg</Text>
            {record.declaredValue && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatCurrency(record.declaredValue)}
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Taxa PoC',
        dataIndex: 'pickupFee',
        key: 'pickupFee',
        width: 100,
        align: 'right',
        render: (fee: number | null) => (
          <Text style={{ fontSize: 12 }}>{formatCurrency(fee)}</Text>
        ),
      },
      {
        title: 'Recebido em',
        dataIndex: 'receivedAt',
        key: 'receivedAt',
        width: 130,
        render: (date: string | null) => (
          <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>
        ),
      },
      {
        title: 'Criado em',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 130,
        render: (date: string) => (
          <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>
        ),
      },
    ],
    []
  );

  const renderSummary = () => {
    const summary = data?.summary;
    if (!summary) return null;

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Total na Fila"
              value={summary.total}
              styles={{ content: { fontSize: 20 } }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Aguardando Entrega"
              value={summary.byStatus?.AWAITING_DROP_OFF_AT_POINT || 0}
              styles={{ content: { fontSize: 20, color: '#fa8c16' } }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Entregues no Ponto"
              value={summary.byStatus?.DROPPED_OFF_AT_POINT || 0}
              styles={{ content: { fontSize: 20, color: '#1890ff' } }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Recebidos"
              value={summary.byStatus?.RECEIVED_AT_POINT || 0}
              styles={{ content: { fontSize: 20, color: '#13c2c2' } }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Aguardando Coleta"
              value={summary.byStatus?.AWAITING_CARRIER_PICKUP_AT_POINT || 0}
              styles={{ content: { fontSize: 20, color: '#722ed1' } }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Comissões"
              value={summary.totalCommission}
              styles={{ content: { fontSize: 20, color: '#52c41a' } }}
              formatter={(value) =>
                `R$ ${Number(value).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              }
            />
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <Flex vertical gap={16}>
      {/* Filtros */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Space wrap size="middle">
          <Input
            placeholder="Buscar por código, nome..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            style={{ width: 180 }}
            options={[
              { label: 'Todos os status', value: 'all' },
              { label: 'Aguardando Entrega', value: 'AWAITING_DROP_OFF_AT_POINT' },
              { label: 'Entregue no Ponto', value: 'DROPPED_OFF_AT_POINT' },
              { label: 'Recebido', value: 'RECEIVED_AT_POINT' },
              { label: 'Aguardando Coleta', value: 'AWAITING_CARRIER_PICKUP_AT_POINT' },
              { label: 'Coletado', value: 'COLLECTED_FROM_POINT' },
            ]}
          />
          <Select
            value={pickupPointId}
            onChange={(v) => {
              setPickupPointId(v);
              setPage(1);
            }}
            style={{ width: 200 }}
            showSearch
            optionFilterProp="label"
            options={[
              { label: 'Todos os pontos', value: 'all' },
              ...(pickupPoints || []).map((p) => ({
                label: p.name,
                value: p.id,
              })),
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              } else {
                setDateRange(null);
              }
              setPage(1);
            }}
            format="DD/MM/YYYY"
            allowClear
            placeholder={['Data início', 'Data fim']}
          />
        </Space>

        <Button
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
          loading={isLoading}
        >
          Atualizar
        </Button>
      </Flex>

      {/* Resumo */}
      {renderSummary()}

      {/* Tabela */}
      <Table<PoCQueueItem>
        dataSource={data?.items || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total: ${total} envios`,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
      />
    </Flex>
  );
}
