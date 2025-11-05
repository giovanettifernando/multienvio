'use client';

import { Card, List, Typography, Tag, Skeleton, Empty, Button, Flex } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

const { Text } = Typography;

interface Pickup {
  id: string;
  scheduledDate: string;
  address: {
    street: string;
    city: string;
    state: string;
  };
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
}

async function fetchPickups(): Promise<Pickup[]> {
  const response = await fetch('/api/pickups?limit=5&upcoming=true');
  if (!response.ok) {
    throw new Error('Failed to fetch pickups');
  }
  const data = await response.json();
  return data.pickups || [];
}

function getStatusLabel(status: Pickup['status']): string {
  switch (status) {
    case 'SCHEDULED':
      return 'Agendada';
    case 'IN_PROGRESS':
      return 'Em andamento';
    case 'COMPLETED':
      return 'Concluída';
    case 'CANCELED':
      return 'Cancelada';
    default:
      return status;
  }
}

function getStatusColor(status: Pickup['status']): string {
  switch (status) {
    case 'SCHEDULED':
      return 'blue';
    case 'IN_PROGRESS':
      return 'processing';
    case 'COMPLETED':
      return 'success';
    case 'CANCELED':
      return 'default';
    default:
      return 'default';
  }
}

export function PickupSchedule() {
  const router = useRouter();
  const { data: pickups, isLoading } = useQuery({
    queryKey: ['pickups-upcoming'],
    queryFn: fetchPickups,
    staleTime: 90_000,
  });

  if (isLoading) {
    return (
      <Card title="Coletas Agendadas" variant="outlined">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <CalendarOutlined />
          <Text>Coletas Agendadas</Text>
        </Flex>
      }
      variant="outlined"
      extra={
        pickups && pickups.length > 0 && (
          <Button
            type="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => router.push('/coletas')}
          >
            Ver todas
          </Button>
        )
      }
    >
      {!pickups || pickups.length === 0 ? (
        <Empty
          description="Nenhuma coleta agendada"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          size="small"
          dataSource={pickups}
          renderItem={(pickup) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/coletas/${pickup.id}`)}
            >
              <Flex justify="space-between" align="center" style={{ width: '100%' }} gap={12}>
                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" gap={4}>
                    <CalendarOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
                    <Text strong style={{ fontSize: '13px' }}>
                      {new Date(pickup.scheduledDate).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </Flex>
                  <Flex align="center" gap={4}>
                    <EnvironmentOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
                    <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                      {pickup.address.street}, {pickup.address.city}/{pickup.address.state}
                    </Text>
                  </Flex>
                </Flex>

                <Tag color={getStatusColor(pickup.status)} style={{ fontSize: '10px' }}>
                  {getStatusLabel(pickup.status)}
                </Tag>
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
