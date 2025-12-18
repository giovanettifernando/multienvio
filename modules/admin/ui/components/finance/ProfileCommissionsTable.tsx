'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Flex,
  Statistic,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Empty,
  Spin,
} from 'antd';
import { ELButton, ELCard, ELSelect, ELDatePicker, ELSegmented } from '@/shared/ui';
import type { TableProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  DownloadOutlined,
  UserOutlined,
  ShopOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type {
  PeriodFilter,
  ProfileType,
  CommissionStatusFilter,
  ProfileCommissionSummary,
  ProfileCommissionItem,
} from '@/modules/admin/application/finance/types';
import { getProfileCommissions } from '@/modules/admin/application/finance/api';
import { formatBRL } from '@/shared/utils/format';
import { formatDateTimeBR } from '@/shared/utils/date';

const { Text, Title } = Typography;

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

// Colunas da tabela expandida (detalhes dos itens)
const itemColumns: TableProps<ProfileCommissionItem>['columns'] = [
  {
    title: 'Código',
    dataIndex: 'referenceCode',
    width: 180,
    render: (v: string) => (
      <Text strong copyable={{ text: v }}>
        {v}
      </Text>
    ),
  },
  {
    title: 'Descrição',
    dataIndex: 'description',
    width: 250,
    ellipsis: true,
  },
  {
    title: 'Comissão',
    dataIndex: 'commissionReais',
    width: 120,
    align: 'right',
    render: (v: number) => (
      <Text strong style={{ color: '#52c41a' }}>
        {formatBRL(v)}
      </Text>
    ),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 110,
    render: (v: 'completed' | 'pending') => {
      const isCompleted = v === 'completed';
      return (
        <Tag
          color={isCompleted ? 'green' : 'gold'}
          icon={isCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
        >
          {isCompleted ? 'Realizado' : 'Previsto'}
        </Tag>
      );
    },
  },
  {
    title: 'Data Criação',
    dataIndex: 'createdAt',
    width: 150,
    render: (v: string) => formatDateTimeBR(v),
  },
  {
    title: 'Data Conclusão',
    dataIndex: 'completedAt',
    width: 150,
    render: (v: string | null) => formatDateTimeBR(v),
  },
];

export function ProfileCommissionsTable() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [profileType, setProfileType] = useState<ProfileType>('collector');
  const [statusFilter, setStatusFilter] = useState<CommissionStatusFilter>('all');
  const [expandedProfiles, setExpandedProfiles] = useState<string[]>([]);

  // Calcular período baseado no preset
  const period = useMemo<PeriodFilter>(() => {
    const now = dayjs();
    switch (periodPreset) {
      case 'today':
        return {
          dateStart: now.startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '7d':
        return {
          dateStart: now.subtract(7, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '30d':
        return {
          dateStart: now.subtract(30, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case 'month':
        return {
          dateStart: now.startOf('month').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case 'lastMonth':
        return {
          dateStart: now.subtract(1, 'month').startOf('month').toISOString(),
          dateEnd: now.subtract(1, 'month').endOf('month').toISOString(),
        };
      case 'custom':
        if (customRange) {
          return {
            dateStart: customRange[0].startOf('day').toISOString(),
            dateEnd: customRange[1].endOf('day').toISOString(),
          };
        }
        return {};
      default:
        return {};
    }
  }, [periodPreset, customRange]);

  // Validar período antes de fazer a query
  const hasValidPeriod = Boolean(period.dateStart && period.dateEnd);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'finance', 'profile-commissions', period, profileType, statusFilter],
    queryFn: () =>
      getProfileCommissions({
        ...period,
        profileType,
        status: statusFilter,
      }),
    enabled: hasValidPeriod,
  });

  // Exportar CSV
  const handleExportCSV = () => {
    if (!data?.profiles) return;

    const rows: string[] = [];
    const profileLabel = profileType === 'collector' ? 'Coletor' : 'Ponto de Coleta';

    // Header
    rows.push(
      [
        profileLabel,
        'Codigo',
        'Descricao',
        'Comissao (R$)',
        'Status',
        'Data Criacao',
        'Data Conclusao',
      ].join(';')
    );

    // Data rows
    for (const profile of data.profiles) {
      for (const item of profile.items) {
        rows.push(
          [
            profile.profileName,
            item.referenceCode,
            item.description,
            item.commissionReais.toFixed(2).replace('.', ','),
            item.status === 'completed' ? 'Realizado' : 'Previsto',
            item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm') : '',
            item.completedAt ? dayjs(item.completedAt).format('DD/MM/YYYY HH:mm') : '',
          ].join(';')
        );
      }
    }

    const csvContent = '\uFEFF' + rows.join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = dayjs().format('YYYY-MM-DD');
    const typeStr = profileType === 'collector' ? 'coletores' : 'pontos-coleta';
    link.download = `comissoes-${typeStr}-${dateStr}.csv`;
    link.click();
  };

  // Colunas da tabela principal (por perfil)
  const profileColumns: TableProps<ProfileCommissionSummary>['columns'] = [
    {
      title: profileType === 'collector' ? 'Coletor' : 'Ponto de Coleta',
      dataIndex: 'profileName',
      width: 250,
      render: (v: string, record) => (
        <Space>
          {profileType === 'collector' ? <UserOutlined /> : <ShopOutlined />}
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Itens',
      dataIndex: 'itemCount',
      width: 80,
      align: 'center',
      render: (v: number) => <Tag>{v}</Tag>,
    },
    {
      title: 'Realizados',
      dataIndex: 'completedCount',
      width: 100,
      align: 'center',
      render: (v: number, record) => (
        <Tag color="green" icon={<CheckCircleOutlined />}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Previstos',
      dataIndex: 'pendingCount',
      width: 100,
      align: 'center',
      render: (v: number) => (
        <Tag color="gold" icon={<ClockCircleOutlined />}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Comissão Realizada',
      dataIndex: 'completedCommissionReais',
      width: 150,
      align: 'right',
      render: (v: number) => (
        <Text style={{ color: '#52c41a' }}>{formatBRL(v)}</Text>
      ),
      sorter: (a, b) => a.completedCommissionReais - b.completedCommissionReais,
    },
    {
      title: 'Comissão Prevista',
      dataIndex: 'pendingCommissionReais',
      width: 150,
      align: 'right',
      render: (v: number) => (
        <Text style={{ color: '#fa8c16' }}>{formatBRL(v)}</Text>
      ),
      sorter: (a, b) => a.pendingCommissionReais - b.pendingCommissionReais,
    },
    {
      title: 'Total',
      dataIndex: 'totalCommissionReais',
      width: 140,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: '#1890ff', fontSize: 15 }}>
          {formatBRL(v)}
        </Text>
      ),
      sorter: (a, b) => a.totalCommissionReais - b.totalCommissionReais,
    },
  ];

  // Renderizar filtros sempre visíveis
  const renderFilters = () => (
    <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
      <Space wrap size="middle">
        <Space size={4}>
          <CalendarOutlined style={{ color: '#8c8c8c' }} />
          <ELSelect
            value={periodPreset}
            onChange={(v) => {
              setPeriodPreset(v);
              if (v !== 'custom') {
                setCustomRange(null);
              }
            }}
            style={{ width: 150 }}
            options={[
              { label: 'Hoje', value: 'today' },
              { label: 'Últimos 7 dias', value: '7d' },
              { label: 'Últimos 30 dias', value: '30d' },
              { label: 'Mês atual', value: 'month' },
              { label: 'Mês anterior', value: 'lastMonth' },
              { label: 'Personalizado', value: 'custom' },
            ]}
          />
        </Space>
        {periodPreset === 'custom' && (
          <ELDatePicker.RangePicker
            value={customRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setCustomRange([dates[0], dates[1]]);
              }
            }}
            format="DD/MM/YYYY"
          />
        )}
        <ELSegmented
          value={profileType}
          onChange={(v) => {
            setProfileType(v as ProfileType);
            setExpandedProfiles([]);
          }}
          options={[
            { label: 'Coletores', value: 'collector', icon: <UserOutlined /> },
            { label: 'Pontos de Coleta', value: 'pickup_point', icon: <ShopOutlined /> },
          ]}
        />
        <ELSelect
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 160 }}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Realizados', value: 'completed' },
            { label: 'Previstos', value: 'pending' },
          ]}
        />
      </Space>

      <ELButton
        icon={<DownloadOutlined />}
        onClick={handleExportCSV}
        disabled={!data || data.profiles.length === 0}
      >
        Exportar CSV
      </ELButton>
    </Flex>
  );

  if (!hasValidPeriod) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Empty description="Selecione um período para visualizar as comissões" />
      </Flex>
    );
  }

  if (isLoading) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Flex vertical justify="center" align="center" gap={12} style={{ minHeight: 300 }}>
          <Spin size="large" />
          <span style={{ color: '#666' }}>Calculando comissões...</span>
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Empty
          description={
            <Space orientation="vertical">
              <Text>Erro ao carregar comissões</Text>
              <Text type="secondary">
                {error instanceof Error ? error.message : 'Erro desconhecido'}
              </Text>
            </Space>
          }
        />
      </Flex>
    );
  }

  if (!data || data.profiles.length === 0) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Empty
          description={`Nenhuma comissão de ${
            profileType === 'collector' ? 'coletores' : 'pontos de coleta'
          } encontrada no período`}
        />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24}>
      {/* Filtros */}
      {renderFilters()}

      {/* Resumo Geral */}
      <ELCard padding="sm">
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={4}>
            <Statistic
              title={profileType === 'collector' ? 'Coletores' : 'Pontos'}
              value={data.summary.totalProfiles}
              prefix={profileType === 'collector' ? <UserOutlined /> : <ShopOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Statistic
              title="Total de Itens"
              value={data.summary.totalItems}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Statistic
              title="Comissão Realizada"
              value={data.summary.completedCommissionReais}
              precision={2}
              prefix={<CheckCircleOutlined />}
              suffix="R$"
              styles={{ content: { color: '#52c41a' } }}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Statistic
              title="Comissão Prevista"
              value={data.summary.pendingCommissionReais}
              precision={2}
              prefix={<ClockCircleOutlined />}
              suffix="R$"
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Total Geral"
              value={data.summary.totalCommissionReais}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="R$"
              styles={{ content: { color: '#1890ff', fontWeight: 'bold' } }}
            />
          </Col>
        </Row>
      </ELCard>

      {/* Tabela por Perfil */}
      <Table<ProfileCommissionSummary>
        rowKey="profileId"
        dataSource={data.profiles}
        columns={profileColumns}
        pagination={false}
        expandable={{
          expandedRowKeys: expandedProfiles,
          onExpandedRowsChange: (keys) => setExpandedProfiles(keys as string[]),
          expandedRowRender: (record) => (
            <div style={{ margin: '8px 0' }}>
              <Title level={5} style={{ marginBottom: 12 }}>
                Detalhamento - {record.profileName} ({record.itemCount} itens)
              </Title>
              <Table<ProfileCommissionItem>
                rowKey="id"
                dataSource={record.items}
                columns={itemColumns}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: (total) => `${total} itens`,
                }}
                size="small"
                scroll={{ x: 1000, y: 'calc(100vh - 600px)' }}
              />
            </div>
          ),
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <Text strong>TOTAL</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="center">
                <Text strong>{data.summary.totalItems}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="center">
                <Text strong style={{ color: '#52c41a' }}>
                  {data.profiles.reduce((sum, p) => sum + p.completedCount, 0)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center">
                <Text strong style={{ color: '#fa8c16' }}>
                  {data.profiles.reduce((sum, p) => sum + p.pendingCount, 0)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong style={{ color: '#52c41a' }}>
                  {formatBRL(data.summary.completedCommissionReais)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong style={{ color: '#fa8c16' }}>
                  {formatBRL(data.summary.pendingCommissionReais)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                <Text strong style={{ color: '#1890ff', fontSize: 16 }}>
                  {formatBRL(data.summary.totalCommissionReais)}
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
        scroll={{ x: 1000, y: 'calc(100vh - 480px)' }}
      />
    </Flex>
  );
}
