'use client';

import { Typography, Tag, Skeleton, Divider } from 'antd';
import { MessageOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/utils/api-fetch';
import type { Status } from '@/lib/validation/support';
import { ELButton } from '@/components/ui/ELButton';
import { ELCard } from '@/components/ui/ELCard';
import { ELFlex } from '@/components/ui/ELGrid';
import { ELEmpty } from '@/components/ui/ELEmpty';

const { Text } = Typography;

interface SupportTicket {
  id: string;
  subject: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const data = await apiFetch<{ tickets: SupportTicket[] }>('/api/support/tickets?limit=5');
  return data.tickets || [];
}

function getStatusLabel(status: Status): string {
  switch (status) {
    case 'aberto':
      return 'Aberto';
    case 'em_atendimento':
      return 'Em atendimento';
    case 'resolvido':
      return 'Resolvido';
    case 'fechado':
      return 'Fechado';
    default:
      return status;
  }
}

function getStatusColor(status: Status): string {
  switch (status) {
    case 'aberto':
      return 'error';
    case 'em_atendimento':
      return 'processing';
    case 'resolvido':
      return 'success';
    case 'fechado':
      return 'default';
    default:
      return 'default';
  }
}

export function SupportQuickView() {
  const router = useRouter();
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets-recent'],
    queryFn: fetchSupportTickets,
    staleTime: 90_000,
  });

  const cardTitle = (
    <ELFlex align="center" gap="sm">
      <MessageOutlined />
      <Text strong>Tickets de Suporte</Text>
    </ELFlex>
  );

  if (isLoading) {
    return (
      <ELCard header={{ title: cardTitle }} style={{ height: '100%' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </ELCard>
    );
  }

  return (
    <ELCard
      style={{ height: '100%' }}
      header={{
        title: cardTitle,
        extra: (
          <ELFlex gap="sm" wrap justify="end">
            <ELButton
              variant="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => router.push('/suporte/novo')}
            >
              Novo
            </ELButton>
            {tickets && tickets.length > 0 && (
              <ELButton
                variant="link"
                size="small"
                icon={<RightOutlined />}
                onClick={() => router.push('/suporte')}
              >
                Todos
              </ELButton>
            )}
          </ELFlex>
        ),
      }}
    >
      {!tickets || tickets.length === 0 ? (
        <ELEmpty
          description="Nenhum ticket aberto"
          primaryAction={{
            label: "Abrir primeiro ticket",
            onClick: () => router.push('/suporte/novo'),
          }}
        />
      ) : (
        <ELFlex direction="col" gap="sm">
          {tickets.map((ticket, index) => (
            <div
              key={ticket.id}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/suporte/${ticket.id}`)}
            >
              {index > 0 && <Divider style={{ margin: '8px 0' }} />}
              <ELFlex justify="between" align="center" style={{ width: '100%' }} gap="md">
                <ELFlex direction="col" style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: '13px' }} ellipsis>
                    {ticket.subject}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    #{ticket.id.slice(0, 8)} •{' '}
                    {new Date(ticket.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </ELFlex>

                <Tag color={getStatusColor(ticket.status)} style={{ fontSize: '10px' }}>
                  {getStatusLabel(ticket.status)}
                </Tag>
              </ELFlex>
            </div>
          ))}
        </ELFlex>
      )}
    </ELCard>
  );
}
