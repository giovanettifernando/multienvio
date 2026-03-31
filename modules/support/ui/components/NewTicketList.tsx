'use client';

import { useEffect } from 'react';
import { ELTag, ELSpace, ELTypography, useELApp } from '@/shared/ui';
const Tag = ELTag;
const Space = ELSpace;
const Typography = ELTypography;
const App = { useApp: useELApp };
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ELButton, ELInput, ELSelect } from '@/shared/ui';
import { useState } from 'react';
import type { SupportTicket, Status, Priority } from '@/shared/validation/support';
import { useTickets } from '@/modules/support/ui/hooks';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
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
  const [statusFilter, setStatusFilter] = useState<Status | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<Priority | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(audience === 'admin' ? 20 : 10);
  const { message } = App.useApp();

  const ticketsQuery = useTickets({
    audience,
    filters: {
      query,
      status: statusFilter ? [statusFilter] : undefined,
      priority: priorityFilter ? [priorityFilter] : undefined,
      requesterEmail: filterByEmail,
    },
    page: audience === 'admin' ? page : undefined,
    pageSize: audience === 'admin' ? pageSize : undefined,
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

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    if (audience === 'admin') {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, priorityFilter, filterByEmail]);

  const tickets = ticketsQuery.data?.tickets ?? [];
  const total = ticketsQuery.data?.total ?? tickets.length;
  const currentPage = ticketsQuery.data?.page ?? page;
  const currentPageSize = ticketsQuery.data?.pageSize ?? pageSize;

  const columns: DataTableColumn<SupportTicket>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: unknown) => (
        <Text code style={{ whiteSpace: 'nowrap' }}>
          {String(id).slice(0, 8)}
        </Text>
      ),
    },
    {
      title: 'Assunto',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: unknown, record: SupportTicket) => (
        <a onClick={() => onTicketClick?.(record.id)}>{String(subject)}</a>
      ),
    },
    ...(showRequester ? [{
      title: 'Solicitante',
      dataIndex: 'requester',
      key: 'requester',
      render: (requester: unknown) => {
        const req = requester as SupportTicket['requester'];
        return (
          <Space orientation="vertical" size={0}>
            <Text strong style={{ whiteSpace: 'nowrap' }}>{req.name}</Text>
            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{req.email}</Text>
          </Space>
        );
      },
    }] as DataTableColumn<SupportTicket>[] : []),
    {
      title: 'Prioridade',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: unknown) => {
        const p = priority as Priority;
        return (
          <Tag color={priorityColors[p]} style={{ whiteSpace: 'nowrap' }}>{priorityLabels[p]}</Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: unknown) => {
        const s = status as Status;
        return (
          <Tag color={statusColors[s]} style={{ whiteSpace: 'nowrap' }}>{statusLabels[s]}</Tag>
        );
      },
    },
    {
      title: 'Criado',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: unknown) => (
        <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{dayjs(date as string).fromNow()}</Text>
      ),
    },
    {
      title: 'Atualizado',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: unknown) => (
        <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{dayjs(date as string).fromNow()}</Text>
      ),
    },
  ];

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <ELInput
          placeholder="Buscar por assunto, descrição ou solicitante"
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
          allowClear
        />
        <ELSelect
          placeholder="Filtrar por status"
          style={{ minWidth: 160, flexShrink: 0, height: 36 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as Status | undefined)}
          options={[
            { value: 'aberto', label: 'Aberto' },
            { value: 'em_atendimento', label: 'Em Atendimento' },
            { value: 'resolvido', label: 'Resolvido' },
            { value: 'fechado', label: 'Fechado' },
          ]}
          allowClear
        />
        <ELSelect
          placeholder="Filtrar por prioridade"
          style={{ minWidth: 160, flexShrink: 0, height: 36 }}
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as Priority | undefined)}
          options={[
            { value: 'baixa', label: 'Baixa' },
            { value: 'media', label: 'Média' },
            { value: 'alta', label: 'Alta' },
            { value: 'critica', label: 'Crítica' },
          ]}
          allowClear
        />
        <ELButton
          icon={<ReloadOutlined />}
          onClick={() => { void ticketsQuery.refetch(); }}
          loading={ticketsQuery.isFetching}
          style={{ flexShrink: 0 }}
        >
          Atualizar
        </ELButton>
      </div>

      <DataTable<SupportTicket>
        data={tickets}
        columns={columns}
        rowKey="id"
        loading={ticketsQuery.isLoading || ticketsQuery.isFetching}
        enableMobileCards={true}
        pagination={
          audience === 'admin'
            ? {
                current: currentPage,
                pageSize: currentPageSize,
                total: total,
                showSizeChanger: true,
                showTotal: (total) => `Total: ${total} chamado${total !== 1 ? 's' : ''}`,
                onChange: (newPage, newPageSize) => {
                  setPage(newPage);
                  if (newPageSize !== currentPageSize) {
                    setPageSize(newPageSize);
                    setPage(1); // Reset para primeira página ao mudar tamanho
                  }
                },
              }
            : {
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total: ${total} chamado${total !== 1 ? 's' : ''}`,
              }
        }
        emptyMessage={ticketsQuery.isLoading ? 'Carregando...' : 'Nenhum chamado encontrado'}
      />
    </Space>
  );
}
