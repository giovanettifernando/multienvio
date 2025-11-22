'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Space, Typography, Input, Select, App, Button } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { SupportTicket, Status, Priority } from '@/lib/validation/support';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';
import { useQuery } from '@tanstack/react-query';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const { Text } = Typography;

interface CollectorTicketListProps {
  onTicketClick?: (ticketId: string) => void;
  isComposing?: boolean;
}

const statusColors: Record<Status, string> = {
  aberto: 'blue',
  em_atendimento: 'orange',
  resolvido: 'green',
  fechado: 'default',
};

const statusLabels: Record<Status, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

const priorityColors: Record<Priority, string> = {
  baixa: 'default',
  media: 'blue',
  alta: 'orange',
  critica: 'red',
};

const priorityLabels: Record<Priority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export function CollectorTicketList({ onTicketClick, isComposing = false }: CollectorTicketListProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const { message } = App.useApp();

  const ticketsQuery = useQuery({
    queryKey: ['collector-tickets', query, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (statusFilter.length > 0) {
        statusFilter.forEach(s => params.append('status', s));
      }
      if (priorityFilter.length > 0) {
        priorityFilter.forEach(p => params.append('priority', p));
      }

      const response = await fetch(`/api/pontos-coleta/tickets?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar chamados');
      }
      return response.json() as Promise<{ tickets: SupportTicket[] }>;
    },
    enabled: !isComposing,
  });

  useEffect(() => {
    if (ticketsQuery.isError) {
      const error = ticketsQuery.error;
      const text = error instanceof Error ? error.message : 'Erro ao carregar chamados';
      message.error(text);
    }
  }, [ticketsQuery.isError, ticketsQuery.error, message]);

  const tickets = ticketsQuery.data?.tickets ?? [];

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Text code style={{ whiteSpace: 'nowrap' }}>
          {id.slice(0, 8)}
        </Text>
      ),
    },
    {
      title: 'Assunto',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: Status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: 'Prioridade',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (priority: Priority) => (
        <Tag color={priorityColors[priority]}>{priorityLabels[priority]}</Tag>
      ),
    },
    {
      title: 'Atualizado',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).fromNow()}</Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Input
          placeholder="Buscar..."
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          mode="multiple"
          placeholder="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ minWidth: 180 }}
          options={[
            { label: 'Aberto', value: 'aberto' },
            { label: 'Em Atendimento', value: 'em_atendimento' },
            { label: 'Resolvido', value: 'resolvido' },
            { label: 'Fechado', value: 'fechado' },
          ]}
          allowClear
        />
        <Select
          mode="multiple"
          placeholder="Prioridade"
          value={priorityFilter}
          onChange={setPriorityFilter}
          style={{ minWidth: 150 }}
          options={[
            { label: 'Baixa', value: 'baixa' },
            { label: 'Média', value: 'media' },
            { label: 'Alta', value: 'alta' },
            { label: 'Crítica', value: 'critica' },
          ]}
          allowClear
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => ticketsQuery.refetch()}
          loading={ticketsQuery.isFetching}
        >
          Atualizar
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={tickets}
        rowKey="id"
        loading={ticketsQuery.isLoading}
        onRow={(record) => ({
          onClick: () => onTicketClick?.(record.id),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total} chamados`,
        }}
      />
    </Space>
  );
}
