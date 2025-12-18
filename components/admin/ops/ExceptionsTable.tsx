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
  Descriptions,
  Image,
  Badge,
} from 'antd';
import { ELModal } from '@/components/ui/ELModal';
import type { TableProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  WarningOutlined,
  RetweetOutlined,
  EnvironmentOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface ExceptionItem {
  id: string;
  type: 'poc_issue' | 'pickup_attempt';
  trackingCode: string | null;
  description: string;
  details: string | null;
  attemptCount?: number;
  issueType?: string | null;
  issuePhotos?: string[] | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  pickupPoint?: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  } | null;
  collector?: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  shipment?: {
    id: string;
    trackingCode: string;
    carrier: string | null;
    recipientName: string | null;
    destinationCity: string;
    destinationState: string;
  } | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ExceptionsResponse {
  items: ExceptionItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    pocIssues: number;
    pickupAttempts: number;
  };
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  poc_issue: { label: 'Divergência PoC', color: 'red', icon: <WarningOutlined /> },
  pickup_attempt: { label: 'Tentativa Coleta', color: 'orange', icon: <RetweetOutlined /> },
};

async function fetchExceptions(params: {
  page: number;
  pageSize: number;
  type?: string;
  dateStart?: string;
  dateEnd?: string;
  q?: string;
}): Promise<ExceptionsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', params.page.toString());
  searchParams.set('pageSize', params.pageSize.toString());
  if (params.type) searchParams.set('type', params.type);
  if (params.dateStart) searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd) searchParams.set('dateEnd', params.dateEnd);
  if (params.q) searchParams.set('q', params.q);

  const res = await fetch(`/api/admin/ops/exceptions?${searchParams}`, {
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Erro ao carregar exceções');
  const json = await res.json();
  return json.data ?? json;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD/MM/YYYY HH:mm');
}

interface ExceptionsTableProps {
  dateStart?: string;
  dateEnd?: string;
}

export default function ExceptionsTable({ dateStart, dateEnd }: ExceptionsTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [type, setType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(
    dateStart && dateEnd
      ? [dayjs(dateStart), dayjs(dateEnd)]
      : null
  );
  const [detailsModal, setDetailsModal] = useState<ExceptionItem | null>(null);

  const { data, isLoading, refetch } = useQuery<ExceptionsResponse>({
    queryKey: [
      'admin',
      'ops',
      'exceptions',
      page,
      pageSize,
      type,
      search,
      dateRange?.[0]?.format('YYYY-MM-DD'),
      dateRange?.[1]?.format('YYYY-MM-DD'),
    ],
    queryFn: () =>
      fetchExceptions({
        page,
        pageSize,
        type: type !== 'all' ? type : undefined,
        dateStart: dateRange?.[0]?.format('YYYY-MM-DD'),
        dateEnd: dateRange?.[1]?.format('YYYY-MM-DD'),
        q: search || undefined,
      }),
  });

  const columns = useMemo<TableProps<ExceptionItem>['columns']>(
    () => [
      {
        title: 'Tipo',
        dataIndex: 'type',
        key: 'type',
        width: 150,
        render: (type: string) => {
          const config = TYPE_CONFIG[type] || { label: type, color: 'default', icon: null };
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
        width: 160,
        render: (code: string | null) => (
          <Text strong style={{ fontSize: 12 }}>
            {code || '-'}
          </Text>
        ),
      },
      {
        title: 'Descrição',
        key: 'description',
        width: 250,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{record.description}</Text>
            {record.details && (
              <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                {record.details.substring(0, 50)}...
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Origem',
        key: 'origin',
        width: 180,
        render: (_, record) => {
          if (record.type === 'poc_issue' && record.pickupPoint) {
            return (
              <Space orientation="vertical" size={0}>
                <Text style={{ fontSize: 12 }}>
                  <EnvironmentOutlined style={{ marginRight: 4 }} />
                  {record.pickupPoint.name}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {record.pickupPoint.city}/{record.pickupPoint.state}
                </Text>
              </Space>
            );
          }
          if (record.type === 'pickup_attempt') {
            return (
              <Space orientation="vertical" size={0}>
                {record.collector && (
                  <Text style={{ fontSize: 12 }}>
                    <UserOutlined style={{ marginRight: 4 }} />
                    {record.collector.name}
                  </Text>
                )}
                {record.user && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Cliente: {record.user.name || record.user.email}
                  </Text>
                )}
              </Space>
            );
          }
          return '-';
        },
      },
      {
        title: 'Destino',
        key: 'destination',
        width: 150,
        render: (_, record) => {
          if (record.shipment) {
            return (
              <Space orientation="vertical" size={0}>
                <Text style={{ fontSize: 12 }}>
                  {record.shipment.destinationCity}/{record.shipment.destinationState}
                </Text>
                {record.shipment.recipientName && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {record.shipment.recipientName}
                  </Text>
                )}
              </Space>
            );
          }
          return '-';
        },
      },
      {
        title: 'Tentativas',
        dataIndex: 'attemptCount',
        key: 'attemptCount',
        width: 90,
        align: 'center',
        render: (count: number | undefined) => {
          if (count === undefined) return '-';
          return (
            <Badge
              count={count}
              style={{ backgroundColor: count > 2 ? '#f5222d' : count > 1 ? '#fa8c16' : '#1890ff' }}
            />
          );
        },
      },
      {
        title: 'Data',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 130,
        render: (date: string) => (
          <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>
        ),
      },
      {
        title: 'Ações',
        key: 'actions',
        width: 100,
        align: 'center',
        render: (_, record) => (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => setDetailsModal(record)}
            size="small"
          >
            Detalhes
          </Button>
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
          <Col xs={24} sm={8}>
            <Statistic
              title="Total de Exceções"
              value={summary.total}
              styles={{ content: { fontSize: 24 } }}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Statistic
              title="Divergências PoC"
              value={summary.pocIssues}
              styles={{ content: { fontSize: 24, color: '#f5222d' } }}
              prefix={<WarningOutlined />}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Statistic
              title="Tentativas de Coleta"
              value={summary.pickupAttempts}
              styles={{ content: { fontSize: 24, color: '#fa8c16' } }}
              prefix={<RetweetOutlined />}
            />
          </Col>
        </Row>
      </Card>
    );
  };

  const renderDetailsModal = () => {
    if (!detailsModal) return null;

    const isPocIssue = detailsModal.type === 'poc_issue';
    const photos = detailsModal.issuePhotos as string[] | null;

    return (
      <ELModal
        title={
          <Space>
            {isPocIssue ? <WarningOutlined style={{ color: '#f5222d' }} /> : <RetweetOutlined style={{ color: '#fa8c16' }} />}
            {isPocIssue ? 'Divergência no Ponto de Coleta' : 'Tentativas de Coleta'}
          </Space>
        }
        open={!!detailsModal}
        onCancel={() => setDetailsModal(null)}
        footer={[
          <Button key="close" onClick={() => setDetailsModal(null)}>
            Fechar
          </Button>,
        ]}
        size="md"
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Código de Rastreio">
            <Text strong>{detailsModal.trackingCode || '-'}</Text>
          </Descriptions.Item>

          {isPocIssue ? (
            <>
              <Descriptions.Item label="Ponto de Coleta">
                {detailsModal.pickupPoint ? (
                  <>
                    {detailsModal.pickupPoint.name}
                    <br />
                    <Text type="secondary">
                      {detailsModal.pickupPoint.city}/{detailsModal.pickupPoint.state}
                    </Text>
                  </>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Tipo de Divergência">
                <Tag color="red">{detailsModal.issueType || 'Não especificado'}</Tag>
              </Descriptions.Item>
            </>
          ) : (
            <>
              <Descriptions.Item label="Coletor">
                {detailsModal.collector ? (
                  <>
                    {detailsModal.collector.name}
                    {detailsModal.collector.phone && (
                      <>
                        <br />
                        <Text type="secondary">{detailsModal.collector.phone}</Text>
                      </>
                    )}
                  </>
                ) : (
                  'Não atribuído'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Cliente">
                {detailsModal.user ? (
                  <>
                    {detailsModal.user.name || detailsModal.user.email}
                    <br />
                    <Text type="secondary">{detailsModal.user.email}</Text>
                  </>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Número de Tentativas">
                <Badge
                  count={detailsModal.attemptCount || 0}
                  style={{
                    backgroundColor:
                      (detailsModal.attemptCount || 0) > 2
                        ? '#f5222d'
                        : (detailsModal.attemptCount || 0) > 1
                        ? '#fa8c16'
                        : '#1890ff',
                  }}
                />
              </Descriptions.Item>
            </>
          )}

          {detailsModal.shipment && (
            <>
              <Descriptions.Item label="Transportadora">
                {detailsModal.shipment.carrier || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Destinatário">
                {detailsModal.shipment.recipientName || '-'}
                <br />
                <Text type="secondary">
                  {detailsModal.shipment.destinationCity}/{detailsModal.shipment.destinationState}
                </Text>
              </Descriptions.Item>
            </>
          )}

          <Descriptions.Item label="Detalhes/Observações">
            {detailsModal.details || 'Nenhuma observação registrada'}
          </Descriptions.Item>

          <Descriptions.Item label="Status">
            <Tag color={detailsModal.status === 'ISSUE_REPORTED' ? 'red' : 'default'}>
              {detailsModal.status}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Data de Registro">
            {formatDate(detailsModal.createdAt)}
          </Descriptions.Item>
        </Descriptions>

        {isPocIssue && photos && photos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Fotos da Divergência:</Text>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Image.PreviewGroup>
                {photos.map((photo, index) => (
                  <Image
                    key={index}
                    src={photo}
                    width={100}
                    height={100}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                    alt={`Foto ${index + 1}`}
                  />
                ))}
              </Image.PreviewGroup>
            </div>
          </div>
        )}
      </ELModal>
    );
  };

  return (
    <Flex vertical gap={16}>
      {/* Filtros */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Space wrap size="middle">
          <Input
            placeholder="Buscar por código, descrição..."
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
            value={type}
            onChange={(v) => {
              setType(v);
              setPage(1);
            }}
            style={{ width: 180 }}
            options={[
              { label: 'Todos os tipos', value: 'all' },
              { label: 'Divergências PoC', value: 'poc_issue' },
              { label: 'Tentativas de Coleta', value: 'pickup_attempt' },
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
      <Table<ExceptionItem>
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
          showTotal: (total) => `Total: ${total} exceções`,
        }}
        scroll={{ x: 'max-content', y: 'calc(100vh - 480px)' }}
        size="small"
      />

      {/* Modal de Detalhes */}
      {renderDetailsModal()}
    </Flex>
  );
}
