'use client';

import { Typography, Tag, Skeleton, Divider } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/shared/utils/api-fetch';
import { ELButton } from '@/shared/ui/ELButton';
import { ELCard } from '@/shared/ui/ELCard';
import { ELFlex } from '@/shared/ui/ELGrid';
import { ELEmpty } from '@/shared/ui/ELEmpty';

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
  return apiFetch('/api/coletas?status=SCHEDULED&pageSize=5');
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
    <ELFlex align="center" gap="sm">
      <CalendarOutlined />
      <Text strong>Coletas Agendadas</Text>
    </ELFlex>
  );

  if (isLoading) {
    return (
      <ELCard header={{ title: cardTitle }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </ELCard>
    );
  }

  return (
    <ELCard
      header={{
        title: cardTitle,
        extra: total > 0 ? (
          <ELButton
            variant="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => router.push('/coletas?status=SCHEDULED')}
          >
            Ver todas
          </ELButton>
        ) : undefined,
      }}
    >
      {pickups.length === 0 ? (
        <ELEmpty description="Nenhuma coleta agendada" />
      ) : (
        <ELFlex direction="col" gap="sm">
          {pickups.map((pickup, index) => (
            <div
              key={pickup.id}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/coletas/${pickup.id}`)}
            >
              {index > 0 && <Divider style={{ margin: '8px 0' }} />}
              <ELFlex justify="between" align="center" style={{ width: '100%' }} gap="md">
                <ELFlex direction="col" style={{ flex: 1, minWidth: 0 }}>
                  <ELFlex align="center" gap="sm">
                    <CalendarOutlined style={{ fontSize: '12px', color: 'var(--el-text-muted, #98A2B3)' }} />
                    <Text strong style={{ fontSize: '13px' }}>
                      {formatScheduleDate(pickup.scheduleAt)}
                    </Text>
                  </ELFlex>
                  <ELFlex align="center" gap="sm">
                    <EnvironmentOutlined style={{ fontSize: '12px', color: 'var(--el-text-muted, #98A2B3)' }} />
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
                  </ELFlex>
                  <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                    {pickup.shipment.trackingCode}
                    {pickup.shipment.carrier && ` • ${pickup.shipment.carrier}`}
                  </Text>
                </ELFlex>

                <Tag color="blue" style={{ fontSize: '10px' }}>
                  Agendada
                </Tag>
              </ELFlex>
            </div>
          ))}
        </ELFlex>
      )}
    </ELCard>
  );
}
