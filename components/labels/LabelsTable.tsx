'use client';

import { useMemo, useState } from 'react';
import Table from 'antd/es/table';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import Popconfirm from 'antd/es/popconfirm';
import App from 'antd/es/app';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOutlined, StopOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { ELInput } from '@/components/ui/ELInput';
import { ELSelect } from '@/components/ui/ELSelect';
import { ELButton } from '@/components/ui/ELButton';
import { ELSkeleton } from '@/components/ui/ELSkeleton';
import { ELEmpty } from '@/components/ui/ELEmpty';
import { ELFlex } from '@/components/ui/ELGrid';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { fetchLabels } from '@/lib/api/labels';
import type { LabelItem, PrintStatus, PackageItem, PackageLabelStatus } from '@/lib/types/label';

// Table and ColumnsType still needed for expandedRowRender nested table

const { Text } = Typography;

export interface LabelsTableProps {
  onOpenLabel: (record: LabelItem) => void;
  onOpenPackage: (pkg: PackageItem, label: LabelItem) => void;
}

// Status do envio (indica se todas as etiquetas foram geradas)
function ShipmentStatusBadge({ record }: { record: LabelItem }) {
  const totalPackages = record.packages.length;
  const generatedPackages = record.packages.filter(p => p.labelStatus === 'generated').length;

  if (totalPackages === 0) {
    return <Tag color="default">Sem volumes</Tag>;
  }

  if (generatedPackages === totalPackages) {
    return <Tag color="success">Todas geradas</Tag>;
  }

  if (generatedPackages === 0) {
    return <Tag color="warning">Falta gerar</Tag>;
  }

  return <Tag color="processing">{generatedPackages}/{totalPackages} geradas</Tag>;
}

// Status badge para package individual
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
// Formato: Origem (UF) → Nome Destinatário, CEP, Cidade (UF)
//          X volumes • Correios SERVIÇO • R$ XX,XX
function ShipmentSummary({ record }: { record: LabelItem }) {
  const originLabel = record.origin.label || 'Origem';
  const originState = record.origin.state ? ` (${record.origin.state})` : '';

  const destName = record.recipient.name;
  const destCep = record.destinationCep;
  const destCity = record.recipient.city || '';
  const destState = record.recipient.state ? ` (${record.recipient.state})` : '';

  return (
    <Space direction="vertical" size={0}>
      <Text>
        <Text strong>{originLabel}</Text>
        {originState} → {destName}, {destCep}, {destCity}
        {destState}
      </Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {record.totalVolumes} {record.totalVolumes === 1 ? 'volume' : 'volumes'} • {record.carrier} {record.service} • {formatCurrency(record.price)}
      </Text>
    </Space>
  );
}

// Resumo do volume (linha filha)
// Formato: Peso • Dimensões • NF-e: CHAVE...VALOR ou Declaração: X itens • R$ XX,XX
function PackageSummary({ pkg }: { pkg: PackageItem }) {
  const weight = `${pkg.weight.toFixed(2)}kg`;
  const dimensions = `${pkg.length}x${pkg.width}x${pkg.height}cm`;

  let contentInfo = '';
  if (pkg.contentType === 'nfe' && pkg.contentSummary) {
    // NF-e: chave...valor
    contentInfo = `NF-e: ${pkg.contentSummary}`;
    if (pkg.contentValue !== undefined) {
      contentInfo += ` • ${formatCurrency(pkg.contentValue)}`;
    }
  } else if (pkg.contentType === 'declaration') {
    // Declaração: X itens • R$ XX,XX
    contentInfo = pkg.contentSummary ? `Declaração: ${pkg.contentSummary}` : 'Declaração';
    if (pkg.contentValue !== undefined) {
      contentInfo += ` • ${formatCurrency(pkg.contentValue)}`;
    }
  }

  return (
    <Text type="secondary" style={{ fontSize: 13 }}>
      {weight} • {dimensions}
      {contentInfo && ` • ${contentInfo}`}
    </Text>
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

  // Necessário para o handler de cancelamento mesmo que não usado diretamente
  void onOpenLabel;

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
    void labelId; // unused but kept for future use
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

  // Colunas da tabela principal (envios)
  const columns: DataTableColumn<LabelItem>[] = [
    {
      title: 'Código Plataforma',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      width: 200,
      showInCard: true,
      cardLabel: 'Código',
      render: (trackingCode) => (
        <Text copyable={!!trackingCode} style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {(trackingCode as string) || '-'}
        </Text>
      ),
    },
    {
      title: 'Resumo do Envio',
      key: 'summary',
      showInCard: true,
      cardLabel: 'Resumo',
      render: (_value, record) => <ShipmentSummary record={record} />,
    },
    {
      title: 'Status Etiqueta',
      key: 'status',
      width: 140,
      showInCard: true,
      cardLabel: 'Status',
      render: (_value, record) => <ShipmentStatusBadge record={record} />,
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 100,
      isActions: true,
      render: () => (
        // Ações apenas nos volumes, não no envio
        <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
      ),
    },
  ];

  // Renderizar linhas expandidas (packages/volumes)
  const expandedRowRender = (record: LabelItem) => {
    const packageColumns: ColumnsType<PackageItem> = [
      {
        title: 'Volume',
        key: 'volume',
        width: 100,
        render: (_, pkg) => (
          <Text strong style={{ fontSize: 13 }}>
            Vol. {pkg.packageNumber}
          </Text>
        ),
      },
      {
        title: 'Resumo do Volume',
        key: 'details',
        render: (_, pkg) => <PackageSummary pkg={pkg} />,
      },
      {
        title: 'Status Etiqueta',
        key: 'status',
        width: 140,
        render: (_, pkg) => <PackageStatusBadge status={pkg.labelStatus} />,
      },
      {
        title: 'Ações',
        key: 'actions',
        width: 180,
        render: (_, pkg) => (
          <Space size="small">
            <ELButton
              variant="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onOpenPackage(pkg, record)}
              disabled={pkg.labelStatus !== 'generated'}
            >
              Visualizar
            </ELButton>
            <Popconfirm
              title="Cancelar pré-postagem"
              description="Tem certeza que deseja cancelar esta etiqueta?"
              onConfirm={() => handleCancelPackage(pkg, record.id)}
              okText="Sim, cancelar"
              cancelText="Não"
              okButtonProps={{ danger: true }}
            >
              <ELButton
                variant="link"
                size="small"
                danger
                icon={<StopOutlined />}
                loading={cancelingPackage === pkg.id}
                disabled={pkg.labelStatus !== 'generated'}
              >
                Cancelar
              </ELButton>
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
        style={{ marginLeft: 32 }}
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
    <ELFlex direction="col" gap="md">
      <ELFlex gap="sm">
        <ELInput.Search
          allowClear
          placeholder="Buscar por código do envio..."
          onSearch={(v) => { setPage(1); setQ(v); }}
          style={{ maxWidth: 300 }}
        />
        <ELSelect
          value={printStatus}
          onChange={(v) => { setPage(1); setPrintStatus(v as PrintStatus | 'all'); }}
          style={{ width: 200 }}
          options={[
            { label: 'Todos os status', value: 'all' },
            { label: 'Faltam imprimir', value: 'not_printed' },
            { label: 'Já impressas', value: 'printed' },
          ]}
        />
      </ELFlex>

      {isLoading ? (
        <ELSkeleton />
      ) : isError ? (
        <ELEmpty title="Falha ao carregar etiquetas" description="Tente novamente em alguns instantes" />
      ) : (
        <DataTable<LabelItem>
          rowKey="id"
          data={data?.items ?? []}
          columns={columns}
          scrollX={800}
          enableMobileCards
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpand: handleExpand,
            expandIcon: ({ expanded, onExpand, record }) =>
              record.packages.length > 0 ? (
                expanded ? (
                  <DownOutlined
                    style={{ cursor: 'pointer', marginRight: 8, color: '#1890ff' }}
                    onClick={(e) => onExpand(record, e)}
                  />
                ) : (
                  <RightOutlined
                    style={{ cursor: 'pointer', marginRight: 8, color: '#1890ff' }}
                    onClick={(e) => onExpand(record, e)}
                  />
                )
              ) : (
                <span style={{ width: 22, display: 'inline-block' }} />
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
          emptyMessage="Nenhuma etiqueta encontrada"
          emptyDescription="Ajuste os filtros de busca"
        />
      )}
    </ELFlex>
  );
}
