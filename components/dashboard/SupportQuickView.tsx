'use client';

import { Card, List, Typography, Tag, Skeleton, Empty, Button, Flex } from 'antd';
import { MessageOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

const { Text } = Typography;

interface SupportTicket {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const response = await fetch('/api/support/tickets?limit=5');
  if (!response.ok) {
    throw new Error('Failed to fetch tickets');
  }
  const data = await response.json();
  return data.tickets || [];
}

function getStatusLabel(status: SupportTicket['status']): string {
  switch (status) {
    case 'OPEN':
      return 'Aberto';
    case 'IN_PROGRESS':
      return 'Em atendimento';
    case 'RESOLVED':
      return 'Resolvido';
    case 'CLOSED':
      return 'Fechado';
    default:
      return status;
  }
}

function getStatusColor(status: SupportTicket['status']): string {
  switch (status) {
    case 'OPEN':
      return 'error';
    case 'IN_PROGRESS':
      return 'processing';
    case 'RESOLVED':
      return 'success';
    case 'CLOSED':
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

  if (isLoading) {
    return (
      <Card title="Tickets de Suporte" variant="outlined">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <MessageOutlined />
          <Text>Tickets de Suporte</Text>
        </Flex>
      }
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
        <List
          size="small"
          dataSource={tickets}
          renderItem={(ticket) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/suporte/${ticket.id}`)}
            >
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
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
