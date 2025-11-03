'use client';

import { useEffect } from 'react';
import { Table, Tag, Space, Typography, Input, Select, App, Button } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { SupportTicket, Status, Priority } from '@/lib/validation/support';
import { useTickets } from '@/hooks/useSupport';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const { Text } = Typography;

interface NewTicketListProps {
  onTicketClick?: (ticketId: string) => void;
  filterByEmail?: string;
  showRequester?: boolean;
  audience?: 'user' | 'admin' | 'collector';
  autoRefresh?: boolean;
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

export function NewTicketList({
  onTicketClick,
  filterByEmail,
  showRequester = false,
  audience = 'user',
  autoRefresh = true,
  isComposing = false,
}: NewTicketListProps) {
  void autoRefresh;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const { message } = App.useApp();

  const ticketsQuery = useTickets({
    audience,
    filters: {
      query,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      priority: priorityFilter.length > 0 ? priorityFilter : undefined,
      requesterEmail: filterByEmail,
    },
    pageSize: audience === 'admin' ? 50 : undefined,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    enabled: !isComposing,
  });

  useEffect(() => {
    if (ticketsQuery.isError) {
      const error = ticketsQuery.error;
      const text = error instanceof Error ? error.message : 'Erro ao carregar chamados';
      message.error(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsQuery.isError, ticketsQuery.error]);

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
      render: (subject: string, record: SupportTicket) => (
        <a onClick={() => onTicketClick?.(record.id)}>{subject}</a>
      ),
    },
    ...(showRequester ? [{
      title: 'Solicitante',
      dataIndex: 'requester',
      key: 'requester',
      width: 200,
      render: (requester: SupportTicket['requester']) => (
        <Space direction="vertical" size={0}>
          <Text strong>{requester.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{requester.email}</Text>
        </Space>
      ),
    }] : []),
    {
      title: 'Prioridade',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: Priority) => (
        <Tag color={priorityColors[priority]}>{priorityLabels[priority]}</Tag>
      ),
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
      title: 'Criado',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).fromNow()}</Text>
      ),
    },
    {
      title: 'Atualizado',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).fromNow()}</Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
        <Space wrap>
          <Input
            placeholder="Buscar por assunto, descrição ou solicitante"
            prefix={<SearchOutlined />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          mode="multiple"
          placeholder="Filtrar por status"
          style={{ minWidth: 200 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'aberto', label: 'Aberto' },
            { value: 'em_atendimento', label: 'Em Atendimento' },
            { value: 'resolvido', label: 'Resolvido' },
            { value: 'fechado', label: 'Fechado' },
          ]}
          allowClear
        />
        <Select
          mode="multiple"
          placeholder="Filtrar por prioridade"
          style={{ minWidth: 200 }}
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={[
            { value: 'baixa', label: 'Baixa' },
            { value: 'media', label: 'Média' },
            { value: 'alta', label: 'Alta' },
            { value: 'critica', label: 'Crítica' },
          ]}
          allowClear
          />
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            void ticketsQuery.refetch();
          }}
          loading={ticketsQuery.isFetching}
          variant="outlined"
        >
          Atualizar
        </Button>
      </Space>

      <Table
        dataSource={tickets}
        columns={columns}
        rowKey="id"
        loading={ticketsQuery.isLoading || ticketsQuery.isFetching}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total} chamado${total !== 1 ? 's' : ''}`,
        }}
        locale={{
          emptyText: ticketsQuery.isLoading ? 'Carregando...' : 'Nenhum chamado encontrado',
        }}
      />
    </Space>
  );
}
