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
  Tooltip,
  DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import {
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface PickupItem {
  id: string;
  status: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  scheduleAt: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  attemptCount: number;
  notes: string | null;
  createdAt: string;
  collector: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  shipment: {
    id: string;
    trackingCode: string;
    carrierTrackingCode: string | null;
    carrier: string | null;
    service: string | null;
    weight: number;
    declaredValue: number;
    recipientName: string | null;
    destinationCity: string;
    destinationState: string;
    pickupFee: number | null;
    status: string;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  } | null;
}

interface PickupsResponse {
  items: PickupItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    byStatus: Record<string, number>;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Pendente', color: 'orange', icon: <ClockCircleOutlined /> },
  SCHEDULED: { label: 'Agendada', color: 'blue', icon: <ClockCircleOutlined /> },
  COLLECTED: { label: 'Coletada', color: 'green', icon: <CheckCircleOutlined /> },
  COMPLETED: { label: 'Concluída', color: 'green', icon: <CheckCircleOutlined /> },
  FAILED: { label: 'Falhou', color: 'red', icon: <ExclamationCircleOutlined /> },
  CANCELED: { label: 'Cancelada', color: 'default', icon: <StopOutlined /> },
};

async function fetchPickups(params: {
  page: number;
  pageSize: number;
  status?: string;
  collectorId?: string;
  dateStart?: string;
  dateEnd?: string;
  q?: string;
}): Promise<PickupsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', params.page.toString());
  searchParams.set('pageSize', params.pageSize.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.collectorId) searchParams.set('collectorId', params.collectorId);
  if (params.dateStart) searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd) searchParams.set('dateEnd', params.dateEnd);
  if (params.q) searchParams.set('q', params.q);

  const res = await fetch(`/api/admin/ops/pickups?${searchParams}`, {
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Erro ao carregar coletas');
  return res.json();
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

interface PickupsTableProps {
  dateStart?: string;
  dateEnd?: string;
}

export default function PickupsTable({ dateStart, dateEnd }: PickupsTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(
    dateStart && dateEnd
      ? [dayjs(dateStart), dayjs(dateEnd)]
      : null
  );

  const { data, isLoading, refetch } = useQuery<PickupsResponse>({
    queryKey: [
      'admin',
      'ops',
      'pickups',
      page,
      pageSize,
      status,
      search,
      dateRange?.[0]?.format('YYYY-MM-DD'),
      dateRange?.[1]?.format('YYYY-MM-DD'),
    ],
    queryFn: () =>
      fetchPickups({
        page,
        pageSize,
        status: status !== 'all' ? status : undefined,
        dateStart: dateRange?.[0]?.format('YYYY-MM-DD'),
        dateEnd: dateRange?.[1]?.format('YYYY-MM-DD'),
        q: search || undefined,
      }),
  });

  const columns = useMemo<ColumnsType<PickupItem>>(
    () => [
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
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
        title: 'Envio',
        key: 'shipment',
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 12 }}>
              {record.shipment?.trackingCode || '-'}
            </Text>
            {record.shipment?.carrier && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.shipment.carrier} {record.shipment.service && `• ${record.shipment.service}`}
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Origem',
        key: 'origin',
        width: 200,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              {record.originCity || 'N/A'}/{record.originUf || 'N/A'}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              CEP: {record.originCep}
            </Text>
            {record.originAddress && (
              <Tooltip title={record.originAddress}>
                <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                  {record.originAddress.substring(0, 30)}...
                </Text>
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: 'Destino',
        key: 'destination',
        width: 150,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>
              {record.shipment?.destinationCity || 'N/A'}/{record.shipment?.destinationState || 'N/A'}
            </Text>
            {record.shipment?.recipientName && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.shipment.recipientName}
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Coletor',
        key: 'collector',
        width: 150,
        render: (_, record) => {
          if (!record.collector) {
            return <Tag color="warning">Não atribuído</Tag>;
          }
          return (
            <Space direction="vertical" size={0}>
              <Text style={{ fontSize: 12 }}>
                <UserOutlined style={{ marginRight: 4 }} />
                {record.collector.name}
              </Text>
              {record.collector.phone && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <PhoneOutlined style={{ marginRight: 4 }} />
                  {record.collector.phone}
                </Text>
              )}
            </Space>
          );
        },
      },
      {
        title: 'Remetente',
        key: 'user',
        width: 150,
        render: (_, record) => {
          if (!record.user) return '-';
          return (
            <Space direction="vertical" size={0}>
              <Text style={{ fontSize: 12 }}>{record.user.name || record.user.email}</Text>
              {record.user.phone && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {record.user.phone}
                </Text>
              )}
            </Space>
          );
        },
      },
      {
        title: 'Agendamento',
        key: 'schedule',
        width: 130,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            {record.scheduleAt ? (
              <Text style={{ fontSize: 12 }}>{formatDate(record.scheduleAt)}</Text>
            ) : record.windowStart && record.windowEnd ? (
              <>
                <Text style={{ fontSize: 11 }}>{formatDate(record.windowStart)}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  até {formatDate(record.windowEnd)}
                </Text>
              </>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>Não agendada</Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Taxa Coleta',
        dataIndex: ['shipment', 'pickupFee'],
        key: 'pickupFee',
        width: 100,
        align: 'right',
        render: (fee: number | null) => (
          <Text style={{ fontSize: 12 }}>{formatCurrency(fee)}</Text>
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
              title="Total"
              value={summary.total}
              valueStyle={{ fontSize: 20 }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Pendentes"
              value={summary.byStatus?.PENDING || 0}
              valueStyle={{ fontSize: 20, color: '#fa8c16' }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Agendadas"
              value={summary.byStatus?.SCHEDULED || 0}
              valueStyle={{ fontSize: 20, color: '#1890ff' }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Coletadas"
              value={(summary.byStatus?.COLLECTED || 0) + (summary.byStatus?.COMPLETED || 0)}
              valueStyle={{ fontSize: 20, color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Falhas"
              value={summary.byStatus?.FAILED || 0}
              valueStyle={{ fontSize: 20, color: '#f5222d' }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Canceladas"
              value={summary.byStatus?.CANCELED || 0}
              valueStyle={{ fontSize: 20, color: '#8c8c8c' }}
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
            placeholder="Buscar por código, cidade..."
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
            style={{ width: 150 }}
            options={[
              { label: 'Todos os status', value: 'all' },
              { label: 'Pendente', value: 'PENDING' },
              { label: 'Agendada', value: 'SCHEDULED' },
              { label: 'Coletada', value: 'COLLECTED' },
              { label: 'Concluída', value: 'COMPLETED' },
              { label: 'Falhou', value: 'FAILED' },
              { label: 'Cancelada', value: 'CANCELED' },
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
      <Table<PickupItem>
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
          showTotal: (total) => `Total: ${total} coletas`,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
      />
    </Flex>
  );
}
