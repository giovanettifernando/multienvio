'use client';

import { useRouter } from 'next/navigation';
import { Table, Button, Space, Switch, Tooltip, Typography, Tag, App } from 'antd';
import type { TableProps } from 'antd';
import { EyeOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { maskCNPJ } from '@/modules/collectors/application/masks';
import { formatBRL } from '@/shared/utils/format';
import DocsStatusBadge from './DocsStatusBadge';
import type { Collector, CollectorListResponse } from '@/modules/collectors/application/types';

const { Text } = Typography;

interface CollectorsTableProps {
  data?: CollectorListResponse;
  loading: boolean;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: 'active' | 'blocked') => void;
  onPageChange: (page: number, pageSize: number) => void;
}

export default function CollectorsTable({
  data,
  loading,
  onDelete,
  onToggleStatus,
  onPageChange,
}: CollectorsTableProps) {
  const router = useRouter();
  const { modal } = App.useApp();

  const handleDelete = (collector: Collector) => {
    modal.confirm({
      title: 'Confirmar exclusão',
      icon: <ExclamationCircleOutlined />,
      content: `Deseja realmente excluir o coletor "${collector.pf.nome}"? Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: () => onDelete(collector.id),
    });
  };

  const handleStatusToggle = (collector: Collector, checked: boolean) => {
    const newStatus = checked ? 'active' : 'blocked';
    modal.confirm({
      title: newStatus === 'active' ? 'Confirmar ativação' : 'Confirmar bloqueio',
      icon: <ExclamationCircleOutlined />,
      content: `Deseja realmente ${newStatus === 'active' ? 'ativar' : 'bloquear'} o coletor "${collector.pf.nome}"?`,
      okText: 'Confirmar',
      cancelText: 'Cancelar',
      onOk: () => onToggleStatus(collector.id, newStatus),
    });
  };

  const columns: TableProps<Collector>['columns'] = [
    {
      title: 'Nome / CNPJ',
      dataIndex: 'pf.nome',
      key: 'nome',
      render: (_: unknown, record: Collector) => (
        <Space orientation="vertical" size={0}>
          <Tooltip title={`Razão social: ${record.pj.razaoSocial}`}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => router.push(`/admin/coletores/${record.id}`)}
            >
              {record.pf.nome}
            </Button>
          </Tooltip>
          <Tooltip title={record.pj.cnpj}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {maskCNPJ(record.pj.cnpj)}
            </Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Veículo',
      key: 'vehicle',
      render: (_: unknown, record: Collector) => {
        const details = [record.vehicle.model, record.vehicle.year].filter(Boolean).join(' · ');
        return (
          <Space orientation="vertical" size={0}>
            <Text strong>{record.vehicle.plate}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {details || '—'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Cidade / UF',
      key: 'location',
      render: (_: unknown, record: Collector) => {
        if (record.pj.endereco.cidade && record.pj.endereco.uf) {
          return `${record.pj.endereco.cidade}/${record.pj.endereco.uf}`;
        }
        if (record.pj.endereco.uf) {
          return record.pj.endereco.uf;
        }
        return '—';
      },
    },
    {
      title: 'Comissão',
      dataIndex: 'commission',
      key: 'commission',
      render: (commission: Collector['commission']) => {
        if (commission.kind === 'fixa') {
          return `${formatBRL(commission.amount)}/coleta`;
        }
        return `${formatBRL(commission.amountPerKm)}/km`;
      },
    },
    {
      title: 'Documentos',
      key: 'documents',
      render: (_: unknown, record: Collector) => <DocsStatusBadge collector={record} />,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: Collector) => (
        <Space size="small">
          <Tag color={record.status === 'active' ? 'green' : 'red'}>
            {record.status === 'active' ? 'Ativo' : 'Bloqueado'}
          </Tag>
          <Switch
            size="small"
            checked={record.status === 'active'}
            onChange={(checked) => handleStatusToggle(record, checked)}
          />
        </Space>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: unknown, record: Collector) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => router.push(`/admin/coletores/${record.id}`)}
          >
            Ver detalhes
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Excluir
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={data?.items || []}
      loading={loading}
      scroll={{ x: 1000, y: 'calc(100vh - 340px)' }}
      pagination={{
        current: data?.page || 1,
        pageSize: data?.pageSize || 10,
        total: data?.total || 0,
        showSizeChanger: true,
        showTotal: (total) => `Total: ${total} coletores`,
        onChange: onPageChange,
      }}
    />
  );
}
