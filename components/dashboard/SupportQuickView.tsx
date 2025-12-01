'use client';

import { Card, Typography, Tag, Skeleton, Empty, Button, Flex, Divider } from 'antd';
import { MessageOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/utils/api-fetch';
import type { Status } from '@/lib/validation/support';

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
    <Flex align="center" gap={8}>
      <MessageOutlined />
      <Text strong>Tickets de Suporte</Text>
    </Flex>
  );

  if (isLoading) {
    return (
      <Card title={cardTitle} variant="outlined">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  return (
    <Card
      title={cardTitle}
      variant="outlined"
      extra={
        <Flex gap={8}>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => router.push('/suporte/novo')}
          >
            Abrir ticket
          </Button>
          {tickets && tickets.length > 0 && (
            <Button
              type="link"
              size="small"
              icon={<RightOutlined />}
              onClick={() => router.push('/suporte')}
            >
              Ver todos
            </Button>
          )}
        </Flex>
      }
    >
      {!tickets || tickets.length === 0 ? (
        <Empty
          description="Nenhum ticket aberto"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/suporte/novo')}
          >
            Abrir primeiro ticket
          </Button>
        </Empty>
      ) : (
        <Flex vertical gap={0}>
          {tickets.map((ticket, index) => (
            <div
              key={ticket.id}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/suporte/${ticket.id}`)}
            >
              {index > 0 && <Divider style={{ margin: '8px 0' }} />}
              <Flex justify="space-between" align="center" style={{ width: '100%' }} gap={12}>
                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
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
                </Flex>

                <Tag color={getStatusColor(ticket.status)} style={{ fontSize: '10px' }}>
                  {getStatusLabel(ticket.status)}
                </Tag>
              </Flex>
            </div>
          ))}
        </Flex>
      )}
    </Card>
  );
}
