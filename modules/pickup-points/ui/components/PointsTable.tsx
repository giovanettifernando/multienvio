'use client';

import { useRouter } from 'next/navigation';
import { Table, Button, Space, Switch, Typography, Tag, App } from 'antd';
import { EyeOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { maskCNPJ } from '@/modules/pickup-points/application/masks';
import { formatBRL } from '@/shared/utils/format';
import type { PickupPoint, PickupPointListResponse } from '@/modules/pickup-points/application/types';

const { Text } = Typography;

interface PointsTableProps {
  data?: PickupPointListResponse;
  loading: boolean;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onPageChange: (page: number, pageSize: number) => void;
}

export default function PointsTable({
  data,
  loading,
  onDelete,
  onToggleStatus,
  onPageChange,
}: PointsTableProps) {
  const router = useRouter();
  const { modal } = App.useApp();

  const handleStatusToggle = (point: PickupPoint, checked: boolean) => {
    const action = checked ? 'ativar' : 'bloquear';

    modal.confirm({
      title: `Confirmar ${action}`,
      icon: <ExclamationCircleOutlined />,
      content: `Deseja realmente ${action} o ponto de coleta "${point.nomeFantasia}"?`,
      okText: 'Confirmar',
      cancelText: 'Cancelar',
      onOk() {
        onToggleStatus(point.id);
      },
    });
  };

  const handleDelete = (point: PickupPoint) => {
    modal.confirm({
      title: 'Confirmar exclusão',
      icon: <ExclamationCircleOutlined />,
      content: `Deseja realmente excluir o ponto de coleta "${point.nomeFantasia}"? Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk() {
        onDelete(point.id);
      },
    });
  };

  const columns: TableProps<PickupPoint>['columns'] = [
    {
      title: 'Nome Fantasia',
      dataIndex: 'nomeFantasia',
      key: 'nomeFantasia',
      render: (text: string, record: PickupPoint) => (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => router.push(`/admin/pontos-de-coleta/${record.id}`)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'CNPJ',
      dataIndex: 'cnpj',
      key: 'cnpj',
      render: (cnpj: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {maskCNPJ(cnpj)}
        </Text>
      ),
    },
    {
      title: 'Cidade/UF',
      key: 'location',
      render: (_: unknown, record: PickupPoint) => {
        if (record.cidade && record.uf) {
          return `${record.cidade}/${record.uf}`;
        }
        if (record.uf) {
          return record.uf;
        }
        return '—';
      },
    },
    {
      title: 'Contato',
      key: 'contact',
      render: (_: unknown, record: PickupPoint) => {
        const contact = [];
        if (record.email) contact.push(record.email);
        if (record.telefone) contact.push(record.telefone);
        return contact.length > 0 ? contact.join(' • ') : '—';
      },
    },
    {
      title: 'Capacidade/dia',
      key: 'capacityPerDay',
      dataIndex: 'capacityPerDay',
      render: (capacity: number | null | undefined) => {
        if (capacity === null || capacity === undefined || capacity === 0) {
          return '—';
        }
        return capacity;
      },
    },
    {
      title: 'Comissão/item',
      key: 'commissionPerItem',
      dataIndex: 'commissionPerItem',
      render: (commission: number | null | undefined) => {
        if (commission === null || commission === undefined) {
          return '—';
        }
        if (commission === 0) {
          return 'R$ 0,00';
        }
        return formatBRL(commission);
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: PickupPoint) => (
        <Space size="small">
          <Tag color={String(record.status) === 'ACTIVE' ? 'green' : 'red'}>
            {String(record.status) === 'ACTIVE' ? 'Ativo' : 'Bloqueado'}
          </Tag>
          <Switch
            checked={String(record.status) === 'ACTIVE'}
            onChange={(checked) => handleStatusToggle(record, checked)}
            size="small"
          />
        </Space>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: unknown, record: PickupPoint) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/admin/pontos-de-coleta/${record.id}`)}
            size="small"
          >
            Ver detalhes
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            size="small"
          >
            Excluir
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data?.items || []}
      loading={loading}
      rowKey="id"
      scroll={{ x: 1000, y: 'calc(100vh - 340px)' }}
      pagination={{
        current: data?.page || 1,
        pageSize: data?.pageSize || 10,
        total: data?.total || 0,
        showSizeChanger: true,
        showTotal: (total) => `Total: ${total} pontos`,
        onChange: onPageChange,
      }}
    />
  );
}
