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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import {
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface ReceptionItem {
  id: string;
  status: string;
  trackingCode: string;
  senderName: string;
  recipientName: string;
  commissionCents: number;
  weight: number | null;
  declaredValue: number | null;
  receivedAt: string | null;
  processedAt: string | null;
  issueType: string | null;
  issueDetails: string | null;
  createdAt: string;
  pickupPoint: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  } | null;
}

interface ReceptionsResponse {
  items: ReceptionItem[];
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
  PENDING: { label: 'Pendente', color: 'orange', icon: <ClockCircleOutlined /> },
  RECEIVED: { label: 'Recebido', color: 'blue', icon: <CheckCircleOutlined /> },
  ISSUE_REPORTED: { label: 'Problema', color: 'red', icon: <ExclamationCircleOutlined /> },
  PROCESSED: { label: 'Processado', color: 'green', icon: <CheckSquareOutlined /> },
};

async function fetchReceptions(params: {
  page: number;
  pageSize: number;
  status?: string;
  pickupPointId?: string;
  dateStart?: string;
  dateEnd?: string;
  q?: string;
}): Promise<ReceptionsResponse> {
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

  if (!res.ok) throw new Error('Erro ao carregar recepções');
  return res.json();
}

async function fetchPickupPoints(): Promise<PickupPointOption[]> {
  const res = await fetch('/api/admin/pickup-points?pageSize=100', {
    credentials: 'include',
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((p: { id: string; name: string }) => ({
    id: p.id,
    name: p.name,
  }));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD/MM/YYYY HH:mm');
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
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

  const { data, isLoading, refetch } = useQuery<ReceptionsResponse>({
    queryKey: [
      'admin',
      'ops',
      'receptions',
      page,
      pageSize,
      status,
      pickupPointId,
      search,
      dateRange?.[0]?.format('YYYY-MM-DD'),
      dateRange?.[1]?.format('YYYY-MM-DD'),
    ],
    queryFn: () =>
      fetchReceptions({
        page,
        pageSize,
        status: status !== 'all' ? status : undefined,
        pickupPointId: pickupPointId !== 'all' ? pickupPointId : undefined,
        dateStart: dateRange?.[0]?.format('YYYY-MM-DD'),
        dateEnd: dateRange?.[1]?.format('YYYY-MM-DD'),
        q: search || undefined,
      }),
  });

  const columns = useMemo<ColumnsType<ReceptionItem>>(
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
        title: 'Código Rastreio',
        dataIndex: 'trackingCode',
        key: 'trackingCode',
        width: 180,
        render: (code: string) => (
          <Text strong style={{ fontSize: 12 }}>
            {code}
          </Text>
        ),
      },
      {
        title: 'Ponto de Coleta',
        key: 'pickupPoint',
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
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
        dataIndex: 'senderName',
        key: 'senderName',
        width: 150,
        render: (name: string) => (
          <Text style={{ fontSize: 12 }}>{name}</Text>
        ),
      },
      {
        title: 'Destinatário',
        dataIndex: 'recipientName',
        key: 'recipientName',
        width: 150,
        render: (name: string) => (
          <Text style={{ fontSize: 12 }}>{name}</Text>
        ),
      },
      {
        title: 'Comissão',
        dataIndex: 'commissionCents',
        key: 'commissionCents',
        width: 100,
        align: 'right',
        render: (cents: number) => (
          <Text style={{ fontSize: 12 }}>{formatCurrency(cents)}</Text>
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
        title: 'Peso/Valor',
        key: 'weightValue',
        width: 100,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            {record.weight && (
              <Text style={{ fontSize: 11 }}>{record.weight.toFixed(2)} kg</Text>
            )}
            {record.declaredValue && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatCurrency(record.declaredValue * 100)}
              </Text>
            )}
            {!record.weight && !record.declaredValue && '-'}
          </Space>
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
              title="Recebidos"
              value={summary.byStatus?.RECEIVED || 0}
              valueStyle={{ fontSize: 20, color: '#1890ff' }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Problemas"
              value={summary.byStatus?.ISSUE_REPORTED || 0}
              valueStyle={{ fontSize: 20, color: '#f5222d' }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Processados"
              value={summary.byStatus?.PROCESSED || 0}
              valueStyle={{ fontSize: 20, color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Comissões"
              value={summary.totalCommission}
              valueStyle={{ fontSize: 20, color: '#722ed1' }}
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
            style={{ width: 150 }}
            options={[
              { label: 'Todos os status', value: 'all' },
              { label: 'Pendente', value: 'PENDING' },
              { label: 'Recebido', value: 'RECEIVED' },
              { label: 'Problema', value: 'ISSUE_REPORTED' },
              { label: 'Processado', value: 'PROCESSED' },
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
      <Table<ReceptionItem>
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
          showTotal: (total) => `Total: ${total} recepções`,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
      />
    </Flex>
  );
}
