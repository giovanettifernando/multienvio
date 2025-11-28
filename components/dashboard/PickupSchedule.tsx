'use client';

import { Card, List, Typography, Tag, Skeleton, Empty, Button, Flex } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

const { Text } = Typography;

interface ScheduledPickup {
  id: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  scheduleAt: string | null;
  status: string;
  shipment: {
    id: string;
    trackingCode: string;
    carrier: string | null;
  };
  collector: {
    id: string;
    name: string;
  } | null;
}

interface PickupResponse {
  items: ScheduledPickup[];
  total: number;
}

async function fetchScheduledPickups(): Promise<PickupResponse> {
  const response = await fetch('/api/coletas?status=SCHEDULED&pageSize=5');
  if (!response.ok) {
    throw new Error('Failed to fetch pickups');
  }
  return response.json();
}

function formatScheduleDate(dateString: string | null): string {
  if (!dateString) return 'A definir';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PickupSchedule() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['pickups-scheduled'],
    queryFn: fetchScheduledPickups,
    staleTime: 90_000,
  });

  const pickups = data?.items || [];
  const total = data?.total || 0;

  const cardTitle = (
    <Flex align="center" gap={8}>
      <CalendarOutlined />
      <Text strong>Coletas Agendadas</Text>
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
        total > 0 && (
          <Button
            type="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => router.push('/coletas?status=SCHEDULED')}
          >
            Ver todas
          </Button>
        )
      }
    >
      {pickups.length === 0 ? (
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
                      {formatScheduleDate(pickup.scheduleAt)}
                    </Text>
                  </Flex>
                  <Flex align="center" gap={4}>
                    <EnvironmentOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
                    <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                      {pickup.originCity && pickup.originUf
                        ? `${pickup.originCity}/${pickup.originUf}`
                        : pickup.originCep}
                    </Text>
                    {pickup.collector && (
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        • {pickup.collector.name}
                      </Text>
                    )}
                  </Flex>
                  <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                    {pickup.shipment.trackingCode}
                    {pickup.shipment.carrier && ` • ${pickup.shipment.carrier}`}
                  </Text>
                </Flex>

                <Tag color="blue" style={{ fontSize: '10px' }}>
                  Agendada
                </Tag>
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
