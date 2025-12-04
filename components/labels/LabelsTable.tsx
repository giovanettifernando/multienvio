'use client';

import { useMemo, useState } from 'react';
import { Table, Space, Button, Input, Select, Flex, Skeleton, Empty, Tag, Typography, Popconfirm, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOutlined, StopOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { fetchLabels } from '@/lib/api/labels';
import type { LabelItem, PrintStatus, PackageItem, PackageLabelStatus } from '@/lib/types/label';

const { Text } = Typography;

export interface LabelsTableProps {
  onOpenLabel: (record: LabelItem) => void;
  onOpenPackage: (pkg: PackageItem, label: LabelItem) => void;
}

// Status badge para etiqueta principal
function LabelStatusBadge({ status }: { status: LabelItem['status'] }) {
  const statusConfig: Record<LabelItem['status'], { color: string; text: string }> = {
    pending: { color: 'warning', text: 'Pendente' },
    paid: { color: 'processing', text: 'Pago' },
    issued: { color: 'success', text: 'Gerada' },
    canceled: { color: 'error', text: 'Cancelada' },
    error: { color: 'error', text: 'Erro' },
  };

  const config = statusConfig[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
}

// Status badge para package
function PackageStatusBadge({ status }: { status: PackageLabelStatus }) {
  const statusConfig: Record<PackageLabelStatus, { color: string; text: string }> = {
    pending: { color: 'warning', text: 'Pendente' },
    generated: { color: 'success', text: 'Gerada' },
    canceled: { color: 'error', text: 'Cancelada' },
    error: { color: 'error', text: 'Erro' },
  };

  const config = statusConfig[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
}

// Formatar valor em BRL
function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Resumo do envio (linha pai)
function ShipmentSummary({ record }: { record: LabelItem }) {
  const origin = record.origin.label || record.origin.city || 'Origem';
  const originState = record.origin.state ? ` (${record.origin.state})` : '';
  const destName = record.recipient.name;
  const destCity = record.recipient.city || '';
  const destState = record.recipient.state ? ` (${record.recipient.state})` : '';

  return (
    <Space direction="vertical" size={0}>
      <Text>
        <Text strong>{origin}</Text>
        {originState} → {destName}, {record.destinationCep}, {destCity}
        {destState}
      </Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {record.totalVolumes} {record.totalVolumes === 1 ? 'volume' : 'volumes'} • {record.carrier} {record.service} • {formatCurrency(record.price)}
      </Text>
    </Space>
  );
}

// Resumo do volume (linha filha)
function PackageSummary({ pkg }: { pkg: PackageItem }) {
  const dimensions = `${pkg.length}x${pkg.width}x${pkg.height}cm`;
  const weight = `${pkg.weight.toFixed(2)}kg`;

  let contentInfo = '';
  if (pkg.contentType === 'nfe' && pkg.contentSummary) {
    contentInfo = pkg.contentSummary;
  } else if (pkg.contentType === 'declaration' && pkg.contentSummary) {
    contentInfo = `Declaração: ${pkg.contentSummary}`;
  }

  return (
    <Space direction="vertical" size={0}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {weight} • {dimensions}
        {contentInfo && ` • ${contentInfo}`}
        {pkg.contentValue !== undefined && ` • ${formatCurrency(pkg.contentValue)}`}
      </Text>
    </Space>
  );
}

export function LabelsTable({ onOpenLabel, onOpenPackage }: LabelsTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [printStatus, setPrintStatus] = useState<PrintStatus | 'all'>('all');
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [cancelingPackage, setCancelingPackage] = useState<string | null>(null);

  const params = useMemo(() => ({
    page,
    pageSize,
    q,
    printStatus: printStatus !== 'all' ? printStatus : undefined,
  }), [page, pageSize, q, printStatus]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['labels', params],
    queryFn: () => fetchLabels(params),
    placeholderData: keepPreviousData,
  });

  // Handler para cancelar package
  const handleCancelPackage = async (pkg: PackageItem, labelId: string) => {
    setCancelingPackage(pkg.id);
    try {
      const response = await fetch(`/api/packages/${pkg.id}/cancel`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao cancelar pré-postagem');
      }

      message.success(`Volume ${pkg.packageNumber} cancelado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    } catch (error) {
      console.error('[CANCEL_PACKAGE]', error);
      message.error(error instanceof Error ? error.message : 'Erro ao cancelar');
    } finally {
      setCancelingPackage(null);
    }
  };

  // Colunas da tabela principal
  const columns: ColumnsType<LabelItem> = [
    {
      title: 'Código Plataforma',
      dataIndex: 'trackingCode',
      width: 220,
      render: (trackingCode: string | null | undefined) => (
        <Text copyable={!!trackingCode} style={{ fontFamily: 'monospace' }}>
          {trackingCode || '-'}
        </Text>
      ),
    },
    {
      title: 'Resumo do Envio',
      key: 'summary',
      render: (_, record) => <ShipmentSummary record={record} />,
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => <LabelStatusBadge status={record.status} />,
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onOpenLabel(record)}
          >
            Visualizar
          </Button>
        </Space>
      ),
    },
  ];

  // Renderizar linhas expandidas (packages)
  const expandedRowRender = (record: LabelItem) => {
    const packageColumns: ColumnsType<PackageItem> = [
      {
        title: 'Volume',
        key: 'volume',
        width: 220,
        render: (_, pkg) => (
          <Space>
            <Text style={{ fontFamily: 'monospace' }}>
              Vol. {pkg.packageNumber}
              {pkg.carrierTrackingCode && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({pkg.carrierTrackingCode})
                </Text>
              )}
            </Text>
          </Space>
        ),
      },
      {
        title: 'Detalhes',
        key: 'details',
        render: (_, pkg) => <PackageSummary pkg={pkg} />,
      },
      {
        title: 'Status',
        key: 'status',
        width: 120,
        render: (_, pkg) => <PackageStatusBadge status={pkg.labelStatus} />,
      },
      {
        title: 'Ações',
        key: 'actions',
        width: 180,
        render: (_, pkg) => (
          <Space>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => onOpenPackage(pkg, record)}
              disabled={pkg.labelStatus !== 'generated'}
            >
              Visualizar
            </Button>
            <Popconfirm
              title="Cancelar pré-postagem"
              description="Tem certeza que deseja cancelar esta etiqueta?"
              onConfirm={() => handleCancelPackage(pkg, record.id)}
              okText="Sim, cancelar"
              cancelText="Não"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="link"
                danger
                icon={<StopOutlined />}
                loading={cancelingPackage === pkg.id}
                disabled={pkg.labelStatus !== 'generated'}
              >
                Cancelar
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Table<PackageItem>
        rowKey="id"
        columns={packageColumns}
        dataSource={record.packages}
        pagination={false}
        size="small"
        showHeader={false}
        style={{ marginLeft: 48 }}
      />
    );
  };

  // Handler para expandir/colapsar
  const handleExpand = (expanded: boolean, record: LabelItem) => {
    if (expanded) {
      setExpandedRowKeys([...expandedRowKeys, record.id]);
    } else {
      setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.id));
    }
  };

  return (
    <Flex vertical gap={12}>
      <Flex wrap="wrap" gap={8} align="center">
        <Input.Search
          allowClear
          placeholder="Buscar por código do envio..."
          onSearch={(v) => { setPage(1); setQ(v); }}
          style={{ maxWidth: 300 }}
        />
        <Select
          value={printStatus}
          onChange={(v) => { setPage(1); setPrintStatus(v as PrintStatus | 'all'); }}
          style={{ width: 200 }}
          options={[
            { label: 'Todos os status', value: 'all' },
            { label: 'Faltam imprimir', value: 'not_printed' },
            { label: 'Já impressas', value: 'printed' },
          ]}
        />
      </Flex>

      {isLoading ? (
        <Skeleton active />
      ) : isError ? (
        <Empty description="Falha ao carregar etiquetas" />
      ) : (
        <Table<LabelItem>
          rowKey="id"
          dataSource={data?.items ?? []}
          columns={columns}
          scroll={{ x: 900 }}
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpand: handleExpand,
            expandIcon: ({ expanded, onExpand, record }) =>
              record.packages.length > 0 ? (
                expanded ? (
                  <DownOutlined
                    style={{ cursor: 'pointer', marginRight: 8 }}
                    onClick={(e) => onExpand(record, e)}
                  />
                ) : (
                  <RightOutlined
                    style={{ cursor: 'pointer', marginRight: 8 }}
                    onClick={(e) => onExpand(record, e)}
                  />
                )
              ) : (
                <span style={{ width: 24, display: 'inline-block' }} />
              ),
            rowExpandable: (record) => record.packages.length > 0,
          }}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          locale={{ emptyText: <Empty description="Nenhuma etiqueta encontrada" /> }}
        />
      )}
    </Flex>
  );
}
